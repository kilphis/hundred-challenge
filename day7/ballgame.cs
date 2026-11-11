// 跳ね返るボールの最小ゲームループ(ターミナル版)
const int Width = 30;
const int Height = 10;

// --- 世界の状態 ---
double x = 2, y = 1;       // 位置
double vx = 12, vy = 0;    // 速度(マス/秒)
const double Gravity = 25; // 重力

// --- ゲームループ ---
const double dt = 1.0 / 60; // 1フレーム=1/60秒
int frame = 0;

while (frame <= 180)
{
    // 1. 入力を読む(今回は無し)

    // 2. 状態を更新する
    vy += Gravity * dt;
    x += vx * dt;
    y += vy * dt;

    if (x < 0 || x >= Width) { vx = -vx; x = Math.Clamp(x, 0, Width - 1); }
    if (y >= Height - 1) { vy = -vy * 0.85; y = Height - 1; } // 床で反発

    // 3. 画面に描く(30フレームごとに1枚表示)
    if (frame % 30 == 0)
    {
        Console.WriteLine($"--- frame {frame} ({frame * dt:F2}秒) ---");
        for (int row = 0; row < Height; row++)
        {
            var line = new char[Width];
            Array.Fill(line, '.');
            if (row == (int)y) line[(int)x] = 'O';
            Console.WriteLine(new string(line));
        }
    }
    frame++;
}
