import SwiftUI

@main
struct MakeTenApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    init() {
        if CommandLine.arguments.contains("--check") { selfCheck(); exit(0) }
        NSApplication.shared.setActivationPolicy(.regular)
    }
    var body: some Scene {
        WindowGroup("メイクテン") { ContentView() }
            .windowResizability(.contentSize)
    }
}

// swift run で起動すると他のアプリの後ろに窓が出るので、起動完了時に最前面へ出す
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.activate(ignoringOtherApps: true)
        // 窓はこの時点で作られていることも、直後に作られることもあるので、次の周回で前に出す
        DispatchQueue.main.async {
            NSApp.windows.first?.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}

func selfCheck() {
    func t(_ a: Int, _ o: String, _ b: Int) -> String { apply(Frac(a), o, Frac(b))?.text ?? "nil" }
    // 3+7=10 / 8÷3=8/3 / 3−8=-5 / 1÷0 は nil
    print(t(3,"+",7), t(8,"÷",3), t(3,"−",8), t(1,"÷",0))
    // 8÷(3−8÷3) = 24 を2つずつ合体して作る
    let x = apply(Frac(8), "÷", Frac(3))!, y = apply(Frac(3), "−", x)!
    print(apply(Frac(8), "÷", y)!.text)
    // 後置 3 7 + 1 × / 後置 8 3 ÷ / 0 で割る
    let v = [3, 7, 1, 1]
    print(stack([.num(0), .num(1), .op("+"), .num(2), .op("×")], values: v) ?? [])
    print(stack([.num(0), .num(1), .op("÷")], values: [8, 3]) ?? [])
    print(stack([.num(0), .num(1), .op("÷")], values: [8, 0]) == nil)
    // 選んだ入力方法が UserDefaults に残る
    let ud = UserDefaults(suiteName: "MakeTenSelfCheck")!
    ud.removePersistentDomain(forName: "MakeTenSelfCheck")
    ud.set(Mode.postfix.rawValue, forKey: modeKey)
    ud.set(Level.advanced.rawValue, forKey: levelKey)
    print("保存した難易度:", Level(rawValue: ud.string(forKey: levelKey) ?? "")?.label ?? "なし")
    print("保存した入力方法:", Mode(rawValue: ud.string(forKey: modeKey) ?? "")?.label ?? "なし")
    // 上級者の演算子
    print("2^3:", t(2,"^",3), " 2^-1:", t(2,"^",-1), " log2 8:", t(2,"log",8), " log2 3:", t(2,"log",3), " log3 1/9:", apply(Frac(3), "log", Frac(1, 9))?.text ?? "nil")
    print("5C2:", t(5,"C",2), " 5P2:", t(5,"P",2), " 2C5:", t(2,"C",5), " ‖3,4‖:", t(3,"‖‖",4), " ‖1,1‖:", t(1,"‖‖",1), " |3-8|:", t(3,"|−|",8))
    let adv = (1...9).flatMap { a in (a...9).flatMap { b in (b...9).flatMap { c in (c...9).map { d in [a,b,c,d] } } } }
    print("上級者の演算子つきで 10 が作れる: \(adv.filter { canMakeTen($0, ops: Level.advanced.ops) }.count) / \(adv.count)")
    let all = (1...9).flatMap { a in (a...9).flatMap { b in (b...9).flatMap { c in (c...9).map { d in [a,b,c,d] } } } }
    let ok = all.filter { canMakeTen($0) }.count
    print("組み合わせ \(all.count) 通りのうち、10 が作れる: \(ok)")
    print("1,1,1,1:", canMakeTen([1,1,1,1]), " 3,3,8,8:", canMakeTen([3,3,8,8]), " 1,5,5,5:", canMakeTen([1,5,5,5]))
}
