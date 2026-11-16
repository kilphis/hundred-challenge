// day30: このMac(Apple M4)の分岐予測器を外から測る。
// 周期 n で繰り返す分岐パターンを流し、予測ミスの割合を見る。
//   実験A 乱数パターン : 長さ n のランダムな T/N 列を繰り返す → どこまで長い列を丸暗記できるか
//   実験B ループ出口   : T を n-1 回、N を1回 → 何回目で抜けるかを覚えられるか(履歴の長さ)
// 予測ミスの数え方は2通り:
//   sudo で実行 → CPU のハードウェアカウンタ(BRANCH_MISPRED_NONSPEC)で実数を数える
//   普通に実行  → 1分岐あたりの時間から推定する(誤差が大きい。実験B は n が大きいと読めない)
// ビルドと実行は run.sh。
#include <dlfcn.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define TOTAL (1u << 24)  // 1回の計測で実行する分岐の数
#define TRIALS 9          // 計測回数(最小値を採る)

static uint64_t now_ns(void) { return clock_gettime_nsec_np(CLOCK_UPTIME_RAW); }

// ---- ハードウェアカウンタ(macOS の非公開フレームワーク kperf / kperfdata を dlopen で使う) ----
static int (*kpc_set_config)(uint32_t, uint64_t *);
static int (*kpc_set_counting)(uint32_t);
static int (*kpc_set_thread_counting)(uint32_t);
static int (*kpc_force_all_ctrs_set)(int);
static int (*kpc_get_thread_counters)(uint32_t, uint32_t, uint64_t *);
static int (*kpep_db_create)(const char *, void **);
static int (*kpep_config_create)(void *, void **);
static int (*kpep_config_force_counters)(void *);
static int (*kpep_db_event)(void *, const char *, void **);
static int (*kpep_config_add_event)(void *, void **, uint32_t, uint32_t *);
static int (*kpep_config_kpc_classes)(void *, uint32_t *);
static int (*kpep_config_kpc_count)(void *, size_t *);
static int (*kpep_config_kpc_map)(void *, size_t *, size_t);
static int (*kpep_config_kpc)(void *, uint64_t *, size_t);

static int pmc_on = 0;
static size_t pmc_idx;  // カウンタ配列の中で BRANCH_MISPRED_NONSPEC が入る位置

static int pmc_init(void) {
    void *kp = dlopen("/System/Library/PrivateFrameworks/kperf.framework/kperf", RTLD_LAZY);
    void *kd = dlopen("/System/Library/PrivateFrameworks/kperfdata.framework/kperfdata", RTLD_LAZY);
    if (!kp || !kd) return 0;
#define LOAD(lib, f) if (!(*(void **)&f = dlsym(lib, #f))) return 0
    LOAD(kp, kpc_set_config); LOAD(kp, kpc_set_counting); LOAD(kp, kpc_set_thread_counting);
    LOAD(kp, kpc_force_all_ctrs_set); LOAD(kp, kpc_get_thread_counters);
    LOAD(kd, kpep_db_create); LOAD(kd, kpep_config_create); LOAD(kd, kpep_config_force_counters);
    LOAD(kd, kpep_db_event); LOAD(kd, kpep_config_add_event); LOAD(kd, kpep_config_kpc_classes);
    LOAD(kd, kpep_config_kpc_count); LOAD(kd, kpep_config_kpc_map); LOAD(kd, kpep_config_kpc);
#undef LOAD
    if (kpc_force_all_ctrs_set(1)) return 0;  // root でないとここで失敗する
    void *db, *cfg, *ev;
    if (kpep_db_create(NULL, &db) || kpep_config_create(db, &cfg) || kpep_config_force_counters(cfg))
        return 0;
    if (kpep_db_event(db, "BRANCH_MISPRED_NONSPEC", &ev) || kpep_config_add_event(cfg, &ev, 0, NULL))
        return 0;
    uint32_t classes;
    size_t count, map[32] = {0};
    uint64_t regs[32] = {0};
    if (kpep_config_kpc_classes(cfg, &classes) || kpep_config_kpc_count(cfg, &count) ||
        kpep_config_kpc_map(cfg, map, sizeof map) || kpep_config_kpc(cfg, regs, sizeof regs))
        return 0;
    if (kpc_set_config(classes, regs) || kpc_set_counting(classes) || kpc_set_thread_counting(classes))
        return 0;
    pmc_idx = map[0];
    return 1;
}

static uint64_t mispred_now(void) {
    uint64_t c[32] = {0};
    kpc_get_thread_counters(0, 32, c);
    return c[pmc_idx];
}

// ---- 測る分岐 ----
// C の if だとコンパイラが分岐なし命令(csel)に変えることがあるので、
// cbz(値が0なら飛ぶ)をインラインアセンブリで直接書く。
static uint64_t run(const uint8_t *p, size_t len, size_t reps) {
    uint64_t c = 0;
    for (size_t r = 0; r < reps; r++)
        for (size_t i = 0; i < len; i++) {
            uint32_t v = p[i];
            __asm__ volatile("cbz %w[v], 1f\n\tadd %[c], %[c], #1\n1:"
                             : [c] "+r"(c)
                             : [v] "r"(v));
        }
    return c;
}

typedef struct {
    double ns;    // 1分岐あたりの時間 [ns]
    double miss;  // 1分岐あたりの予測ミス数(カウンタの実測。カウンタなしなら -1)
} Result;

// 周期 n のパターン pat を、n の倍数の長さのバッファに敷き詰めて測る。
static Result measure(const uint8_t *pat, size_t n) {
    size_t copies = n >= (1u << 20) ? 1 : ((1u << 20) + n - 1) / n;
    size_t len = n * copies;
    uint8_t *buf = malloc(len);
    for (size_t k = 0; k < copies; k++) memcpy(buf + k * n, pat, n);
    size_t reps = TOTAL / len ? TOTAL / len : 1;
    double branches = (double)(len * reps);

    volatile uint64_t sink = run(buf, len, reps);  // 予熱(予測器に学習させる)
    Result best = {1e30, 1e30};
    for (int t = 0; t < TRIALS; t++) {
        uint64_t m0 = pmc_on ? mispred_now() : 0;
        uint64_t t0 = now_ns();
        sink += run(buf, len, reps);
        uint64_t t1 = now_ns();
        uint64_t m1 = pmc_on ? mispred_now() : 0;
        double ns = (double)(t1 - t0) / branches;
        double miss = (double)(m1 - m0) / branches;
        if (ns < best.ns) best.ns = ns;
        if (miss < best.miss) best.miss = miss;
    }
    (void)sink;
    free(buf);
    if (!pmc_on) best.miss = -1;
    return best;
}

static uint64_t rng = 88172645463325252ull;
static uint8_t rbit(void) {
    rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17;
    return (uint8_t)(rng >> 63);
}

static void bar(double x) {  // 0..1 を 40 文字の棒にする
    int w = (int)(x * 40 + 0.5);
    if (w < 0) w = 0;
    if (w > 40) w = 40;
    for (int i = 0; i < w; i++) putchar('#');
}

int main(int argc, char **argv) {
    int ecore = argc > 1 && strcmp(argv[1], "--ecore") == 0;
    // macOS ではコアを直接指定できないので QoS で寄せる(BACKGROUND は高効率コアだけで動く)
    pthread_set_qos_class_self_np(ecore ? QOS_CLASS_BACKGROUND : QOS_CLASS_USER_INTERACTIVE, 0);
    const char *core = ecore ? "E" : "P";
    pmc_on = pmc_init();

    // CPU のクロックが上がりきるまで 0.5 秒空回しする(しないと最初の計測だけ遅く出る)
    for (uint64_t t0 = now_ns(); now_ns() - t0 < 500000000ull;) __asm__ volatile("");

    size_t maxn = 1u << 22;
    uint8_t *pat = malloc(maxn);

    // 基準: いつも成立(予測ミスなし)と、完全な乱数(ミス率 50%)。基準は3回測って最小を採る
    memset(pat, 1, 1);
    double t_base = 1e30;
    for (int i = 0; i < 3; i++) {
        double t = measure(pat, 1).ns;
        if (t < t_base) t_base = t;
    }
    for (size_t i = 0; i < maxn; i++) pat[i] = rbit();
    Result r_rand = measure(pat, maxn);
    double penalty = 2 * (r_rand.ns - t_base);  // 1回のミスで増える時間 [ns](時間で推定するときに使う)

    printf("# core=%s  ミスの数え方: %s\n", core,
           pmc_on ? "ハードウェアカウンタ(実測)" : "時間から推定(sudo で実行するとカウンタで実測)");
    printf("# 基準(常に成立) %.3f ns/分岐  乱数 %.3f ns/分岐  → ミス1回 ≈ %.2f ns", t_base, r_rand.ns,
           pmc_on ? (r_rand.ns - t_base) / r_rand.miss : penalty);
    if (pmc_on) printf("  (乱数のミス率 実測 %.1f%%)", 100 * r_rand.miss);
    printf("\n");
    fprintf(stderr, "core,exp,n,ns_per_branch,miss_per_branch,source\n");
    const char *src = pmc_on ? "pmc" : "time";

    // 実験A: 長さ n の乱数列を繰り返す。覚えきれればミス率 0、覚えられなければ 50%
    printf("\n## 実験A 乱数パターン(周期 n)  ミス率 (0〜50%%)\n");
    for (int k = 1; k <= 22; k++) {
        size_t ns_[2] = {(size_t)1 << k, ((size_t)3 << k) / 2};
        for (int j = 0; j < 2; j++) {
            size_t n = ns_[j];
            if (n > maxn || (j == 1 && k == 1)) continue;
            for (size_t i = 0; i < n; i++) pat[i] = rbit();
            Result r = measure(pat, n);
            double miss = pmc_on ? r.miss : (r.ns - t_base) / penalty;
            printf("n=%8zu  %6.3f ns  %5.1f%%  ", n, r.ns, 100 * miss);
            bar(miss * 2);
            putchar('\n');
            fprintf(stderr, "%s,A,%zu,%.4f,%.6f,%s\n", core, n, r.ns, miss, src);
        }
    }

    // 実験B: T を n-1 回 → N を1回。覚えられなければ1周期に1回ミス
    // 時間で推定するときは、n が大きいとミス1回の影響が 1/n に薄まり誤差に埋もれる
    printf("\n## 実験B ループ出口(T×(n-1) のあと N)  1周期あたりのミス回数 (0〜1)\n");
    size_t bn[] = {2,  4,   6,   8,   10,  12,  16,  20,  24,  32,   40,   48,   56,   64,  80,
                   96, 112, 128, 160, 192, 256, 384, 512, 768, 1024, 1536, 2048, 4096, 8192};
    size_t nb = sizeof bn / sizeof bn[0];
    if (!pmc_on) nb -= 4;  // 時間での推定は 1024 まで
    for (size_t j = 0; j < nb; j++) {
        size_t n = bn[j];
        memset(pat, 1, n - 1);
        pat[n - 1] = 0;
        Result r = measure(pat, n);
        double per = pmc_on ? r.miss * n : (r.ns - t_base) * n / penalty;
        printf("n=%8zu  %6.3f ns  %5.2f回  ", n, r.ns, per);
        bar(per);
        putchar('\n');
        fprintf(stderr, "%s,B,%zu,%.4f,%.6f,%s\n", core, n, r.ns, per, src);
    }

    if (pmc_on) {
        kpc_set_counting(0);
        kpc_set_thread_counting(0);
        kpc_force_all_ctrs_set(0);
    }
    free(pat);
    return 0;
}
