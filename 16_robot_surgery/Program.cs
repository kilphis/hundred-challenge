// day16 ロボット手術シミュレーション(C# + Raylib-cs)
// 実行: dotnet run
using System.Numerics;
using System.Reflection;
using Raylib_cs;

const int W = 1100, H = 720;
Raylib.SetConfigFlags(ConfigFlags.Msaa4xHint);
Raylib.InitWindow(W, H, "Robot Surgery");
Raylib.SetTargetFPS(60);
Raylib.SetExitKey(KeyboardKey.Null);
Gfx.LoadFont();

var tasks = new Func<SurgeryTask>[] { () => new Incision(), () => new Removal(), () => new Suture() };
int idx = 0;
SurgeryTask task = tasks[0]();
var state = Phase.Title;
float total = 0f;
// 動きの縮小倍率(実機の 1.5:1 / 2:1 / 3:1)。手の動き ÷ 倍率 = 器具の動き
float[] scales = { 1.5f, 2f, 3f };
int scaleIdx = 1;
Vector2 tip = new(W / 2f, H / 2f);
Vector2 port = new(W / 2f, H + 40);

while (!Raylib.WindowShouldClose())
{
    float dt = Raylib.GetFrameTime();
    if (Raylib.IsKeyPressed(KeyboardKey.One)) scaleIdx = 0;
    if (Raylib.IsKeyPressed(KeyboardKey.Two)) scaleIdx = 1;
    if (Raylib.IsKeyPressed(KeyboardKey.Three)) scaleIdx = 2;
    if (Raylib.IsKeyPressed(KeyboardKey.Escape))
    {
        if (Raylib.IsCursorHidden()) Raylib.EnableCursor(); else break;
    }

    switch (state)
    {
        case Phase.Title:
            if (Raylib.IsKeyPressed(KeyboardKey.Space)) { state = Phase.Brief; }
            break;
        case Phase.Brief:
            if (Raylib.IsKeyPressed(KeyboardKey.Space))
            {
                task = tasks[idx]();
                tip = task.Start;
                Raylib.DisableCursor();
                state = Phase.Play;
            }
            break;
        case Phase.Play:
            if (!Raylib.IsCursorHidden()) { if (Raylib.IsMouseButtonPressed(MouseButton.Left)) Raylib.DisableCursor(); break; }
            tip += Raylib.GetMouseDelta() / scales[scaleIdx];
            tip = Vector2.Clamp(tip, Vector2.Zero, new Vector2(W, H));
            task.Elapsed += dt;
            task.Update(tip, Raylib.IsMouseButtonDown(MouseButton.Left), Raylib.IsMouseButtonPressed(MouseButton.Left));
            if (task.Result == null)
            {
                foreach (var v in task.Vessels)
                    if (Gfx.DistToPolyline(tip, v) < Gfx.VesselWidth / 2 + 2) { task.Result = T.FailVessel; break; }
            }
            if (task.Result == null && task.Elapsed > task.Limit) task.Result = T.FailTime;
            if (task.Result != null)
            {
                Raylib.EnableCursor();
                if (task.Result == T.Success) { total += task.Elapsed; state = idx == tasks.Length - 1 ? Phase.Done : Phase.Success; }
                else state = Phase.Fail;
            }
            break;
        case Phase.Success:
            if (Raylib.IsKeyPressed(KeyboardKey.Space)) { idx++; state = Phase.Brief; }
            break;
        case Phase.Fail:
            if (Raylib.IsKeyPressed(KeyboardKey.R)) state = Phase.Brief;
            break;
        case Phase.Done:
            if (Raylib.IsKeyPressed(KeyboardKey.R)) { idx = 0; total = 0; state = Phase.Title; }
            break;
    }

    Raylib.BeginDrawing();
    Raylib.ClearBackground(new Color(18, 24, 28, 255));
    if (state == Phase.Title)
    {
        Gfx.Text(T.Title, 80, 120, 48, Color.White);
        Gfx.Text(T.TitleSub, 80, 190, 24, Color.LightGray);
        Gfx.Text(T.Controls, 80, 280, 22, Color.LightGray);
        Gfx.Text(T.PressSpace, 80, 560, 26, Color.Yellow);
    }
    else
    {
        task.Draw(tip);
        foreach (var v in task.Vessels) Gfx.Polyline(v, Gfx.VesselWidth, new Color(170, 40, 60, 255));
        // 器具: ポートから先端へのシャフト
        Raylib.DrawLineEx(port, tip, 10, new Color(150, 160, 170, 255));
        bool closed = Raylib.IsMouseButtonDown(MouseButton.Left) && state == Phase.Play;
        Raylib.DrawCircleV(tip, closed ? 4 : 7, closed ? Color.Yellow : Color.White);

        Raylib.DrawRectangle(0, 0, W, 44, new Color(0, 0, 0, 170));
        Gfx.Text($"{T.Step} {idx + 1}/{tasks.Length}  {task.Name}", 16, 10, 24, Color.White);
        Gfx.Text($"{task.Elapsed:0.0} / {task.Limit:0} {T.Sec}", 520, 10, 24, task.Limit - task.Elapsed < 5 ? Color.Red : Color.White);
        Gfx.Text($"{T.Scale} {scales[scaleIdx]:0.#}:1 (1/2/3)", 790, 10, 24, Color.SkyBlue);
        if (state == Phase.Play && !Raylib.IsCursorHidden()) Gfx.Text(T.Paused, 16, 56, 22, Color.Yellow);

        if (state != Phase.Play)
        {
            Raylib.DrawRectangle(0, 0, W, H, new Color(0, 0, 0, 160));
            switch (state)
            {
                case Phase.Brief:
                    Gfx.Text(T.Boss, 120, 200, 28, Color.LightGray);
                    Gfx.Text(task.Order, 120, 250, 30, Color.White);
                    Gfx.Text(T.Danger, 120, 340, 22, new Color(230, 110, 120, 255));
                    Gfx.Text(T.PressSpace, 120, 420, 26, Color.Yellow);
                    break;
                case Phase.Success:
                    Gfx.Text(T.Success, 120, 240, 48, Color.Green);
                    Gfx.Text($"{task.Elapsed:0.0} {T.Sec}", 120, 310, 28, Color.White);
                    Gfx.Text(T.Next, 120, 380, 26, Color.Yellow);
                    break;
                case Phase.Fail:
                    Gfx.Text(T.Fail, 120, 240, 48, Color.Red);
                    Gfx.Text(task.Result ?? "", 120, 310, 28, Color.White);
                    Gfx.Text(T.Retry, 120, 380, 26, Color.Yellow);
                    break;
                case Phase.Done:
                    Gfx.Text(T.Done, 120, 240, 48, Color.Green);
                    Gfx.Text($"{T.Total} {total:0.0} {T.Sec}", 120, 310, 28, Color.White);
                    Gfx.Text(T.Again, 120, 380, 26, Color.Yellow);
                    break;
            }
        }
    }
    Raylib.EndDrawing();
}
Raylib.CloseWindow();

enum Phase { Title, Brief, Play, Success, Fail, Done }

// 画面に出す文字。フォントはここに書いた文字だけ読み込む
static class T
{
    public const string Title = "ロボット手術シミュレーション";
    public const string TitleSub = "ボスの指示どおりに施術を完遂せよ";
    public const string Controls = "マウス: 器具を動かす\n左クリック(押したまま): 把持・切開・刺入\n1 / 2 / 3: 動きの縮小倍率 1.5:1 / 2:1 / 3:1\nEsc: カーソルを戻す(もう一度で終了)";
    public const string PressSpace = "スペースで開始";
    public const string Boss = "ボス「";
    public const string Danger = "血管(赤い線)に触れたら失敗。制限時間を過ぎても失敗。";
    public const string Step = "施術";
    public const string Sec = "秒";
    public const string Scale = "縮小倍率";
    public const string Paused = "一時停止中: クリックで再開";
    public const string Success = "成功";
    public const string Fail = "失敗";
    public const string Next = "スペースで次の施術へ";
    public const string Retry = "R でこの施術をやり直す";
    public const string Done = "手術完了";
    public const string Total = "合計";
    public const string Again = "R で最初から";
    public const string FailVessel = "血管を傷つけた";
    public const string FailTime = "時間切れ";
    public const string FailLine = "切開線から外れた";
    public const string FailPoint = "刺入位置がずれた";
    public const string Incision = "切開";
    public const string IncisionOrder = "点線に沿って切開しろ。始点から終点まで、左クリックを押したまま。」";
    public const string Removal = "摘出";
    public const string RemovalOrder = "患部(紫)をつかんで、回収袋まで運べ。」";
    public const string Suture = "縫合";
    public const string SutureOrder = "切開した所を縫え。番号順に刺入点をクリック。」";
    public const string Start = "始点";
    public const string End = "終点";
    public const string Bag = "回収袋";
}

abstract class SurgeryTask
{
    public float Elapsed;
    public string? Result;
    public abstract string Name { get; }
    public abstract string Order { get; }
    public abstract float Limit { get; }
    public abstract Vector2 Start { get; }
    public abstract Vector2[][] Vessels { get; }
    public abstract void Update(Vector2 tip, bool down, bool pressed);
    public abstract void Draw(Vector2 tip);

    protected static void DrawTissue()
    {
        Raylib.DrawEllipse(550, 390, 470, 300, new Color(214, 150, 140, 255));
        Raylib.DrawEllipse(550, 390, 440, 275, new Color(226, 170, 158, 255));
    }
}

// 1. 切開: 点線から外れずに始点→終点まで
class Incision : SurgeryTask
{
    static readonly Vector2 A = new(330, 400), B = new(770, 380);
    const float Tol = 9f;
    float progress; // 0..1 どこまで切れたか
    readonly List<Vector2> cut = new();
    public override string Name => T.Incision;
    public override string Order => T.IncisionOrder;
    public override float Limit => 30;
    public override Vector2 Start => new(180, 400);
    public override Vector2[][] Vessels { get; } =
    {
        new Vector2[] { new(300, 300), new(420, 340), new(560, 330), new(700, 300), new(820, 310) },
        new Vector2[] { new(320, 480), new(450, 460), new(600, 470), new(780, 450) },
    };

    public override void Update(Vector2 tip, bool down, bool pressed)
    {
        if (!down) return;
        var (t, d) = Gfx.Project(tip, A, B);
        if (progress == 0 && Vector2.Distance(tip, A) > Tol * 2) return; // 始点から始める
        if (d > Tol) { Result = T.FailLine; return; }
        if (t > progress && t - progress < 0.05f) { progress = t; cut.Add(tip); }
        if (progress > 0.98f) Result = T.Success;
    }

    public override void Draw(Vector2 tip)
    {
        DrawTissue();
        for (float s = 0; s < 1; s += 0.03f)
            Raylib.DrawLineEx(Vector2.Lerp(A, B, s), Vector2.Lerp(A, B, s + 0.015f), 2, new Color(40, 60, 120, 255));
        for (int i = 1; i < cut.Count; i++) Raylib.DrawLineEx(cut[i - 1], cut[i], 4, new Color(120, 30, 40, 255));
        Raylib.DrawCircleV(A, 6, Color.DarkGreen); Gfx.Text(T.Start, (int)A.X - 20, (int)A.Y + 12, 18, Color.DarkGreen);
        Raylib.DrawCircleV(B, 6, Color.DarkBlue); Gfx.Text(T.End, (int)B.X - 20, (int)B.Y + 12, 18, Color.DarkBlue);
    }
}

// 2. 摘出: 患部をつかんで回収袋へ
class Removal : SurgeryTask
{
    Vector2 piece = new(420, 330);
    bool held;
    static readonly Rectangle Bag = new(760, 470, 120, 90);
    public override string Name => T.Removal;
    public override string Order => T.RemovalOrder;
    public override float Limit => 30;
    public override Vector2 Start => new(300, 520);
    public override Vector2[][] Vessels { get; } =
    {
        new Vector2[] { new(560, 180), new(590, 300), new(570, 420), new(610, 600) },
        new Vector2[] { new(330, 250), new(470, 260), new(520, 230) },
        new Vector2[] { new(640, 360), new(720, 420), new(700, 560) },
    };

    public override void Update(Vector2 tip, bool down, bool pressed)
    {
        if (pressed && Vector2.Distance(tip, piece) < 16) held = true;
        if (held && down) piece = tip;
        if (held && !down)
        {
            held = false;
            if (Raylib.CheckCollisionPointRec(piece, Bag)) Result = T.Success;
        }
    }

    public override void Draw(Vector2 tip)
    {
        DrawTissue();
        Raylib.DrawRectangleRec(Bag, new Color(200, 210, 220, 255));
        Raylib.DrawRectangleLinesEx(Bag, 2, Color.DarkGray);
        Gfx.Text(T.Bag, (int)Bag.X + 30, (int)Bag.Y + 34, 20, Color.DarkGray);
        Raylib.DrawCircleV(piece, 14, new Color(120, 70, 150, 255));
    }
}

// 3. 縫合: 切開線の両側の刺入点を番号順にクリック
class Suture : SurgeryTask
{
    readonly Vector2[] points;
    int next;
    const float R = 8f;
    public override string Name => T.Suture;
    public override string Order => T.SutureOrder;
    public override float Limit => 40;
    public override Vector2 Start => new(180, 400);
    public override Vector2[][] Vessels { get; } =
    {
        new Vector2[] { new(300, 300), new(420, 335), new(560, 332), new(700, 305), new(820, 310) },
        new Vector2[] { new(320, 470), new(450, 450), new(600, 462), new(780, 445) },
    };

    public Suture()
    {
        var p = new List<Vector2>();
        for (int i = 0; i < 4; i++)
        {
            float x = 400 + i * 100;
            float y = 400 - (x - 330) * 20f / 440f; // 切開線上
            p.Add(new(x, y - 26)); p.Add(new(x, y + 26));
        }
        points = p.ToArray();
    }

    public override void Update(Vector2 tip, bool down, bool pressed)
    {
        if (!pressed) return;
        if (Vector2.Distance(tip, points[next]) > R) { Result = T.FailPoint; return; }
        next++;
        if (next == points.Length) Result = T.Success;
    }

    public override void Draw(Vector2 tip)
    {
        DrawTissue();
        Raylib.DrawLineEx(new(330, 400), new(770, 380), 4, new Color(120, 30, 40, 255));
        for (int i = 1; i < next; i++)
            Raylib.DrawLineEx(points[i - 1], points[i], 2, new Color(30, 30, 90, 255));
        for (int i = 0; i < points.Length; i++)
        {
            var c = i < next ? Color.DarkGray : i == next ? Color.DarkBlue : new Color(60, 80, 140, 255);
            Raylib.DrawCircleLinesV(points[i], R, c);
            if (i >= next) Gfx.Text($"{i + 1}", (int)points[i].X + 10, (int)points[i].Y - 8, 16, c);
        }
    }
}

static class Gfx
{
    public const float VesselWidth = 6f;
    static Font font;

    public static void LoadFont()
    {
        var chars = string.Concat(typeof(T).GetFields(BindingFlags.Public | BindingFlags.Static).Select(f => (string)f.GetRawConstantValue()!));
        for (int c = 32; c < 127; c++) chars += (char)c;
        int[] cps = chars.Distinct().Select(c => (int)c).ToArray();
        string[] candidates = { "/Library/Fonts/Arial Unicode.ttf", Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + "/Library/Fonts/PlemolJP35ConsoleNF-Regular.ttf" };
        var path = candidates.FirstOrDefault(File.Exists);
        font = path != null ? Raylib.LoadFontEx(path, 48, cps, cps.Length) : Raylib.GetFontDefault();
        Raylib.SetTextureFilter(font.Texture, TextureFilter.Bilinear);
    }

    public static void Text(string s, int x, int y, int size, Color c) =>
        Raylib.DrawTextEx(font, s, new Vector2(x, y), size, 1, c);

    public static void Polyline(Vector2[] pts, float w, Color c)
    {
        for (int i = 1; i < pts.Length; i++) Raylib.DrawLineEx(pts[i - 1], pts[i], w, c);
        foreach (var p in pts) Raylib.DrawCircleV(p, w / 2, c);
    }

    // 点 p を線分 ab に射影: (線分上の位置 0..1, 距離)
    public static (float t, float d) Project(Vector2 p, Vector2 a, Vector2 b)
    {
        var ab = b - a;
        float t = Math.Clamp(Vector2.Dot(p - a, ab) / ab.LengthSquared(), 0, 1);
        return (t, Vector2.Distance(p, a + ab * t));
    }

    public static float DistToPolyline(Vector2 p, Vector2[] pts)
    {
        float m = float.MaxValue;
        for (int i = 1; i < pts.Length; i++) m = Math.Min(m, Project(p, pts[i - 1], pts[i]).d);
        return m;
    }
}
