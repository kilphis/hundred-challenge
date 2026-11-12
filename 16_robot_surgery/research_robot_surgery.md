# ロボット手術の現場 — 調べたこと(2026-11-12)

Web検索でまとめた。代表機は米インテュイティブサージカル社の「ダヴィンチ」。国産機「hinotori」(メディカロイド社。川崎重工とシスメックスの共同出資)もある。

## 1. 機械の構成(3つの台)

| 台 | 何をするか |
|---|---|
| サージョンコンソール | 術者が座って操作する台。のぞき込むと 3D 映像が見え、両手でコントローラを握り、足元にペダルがある |
| ペイシェントカート | 患者の横に置く本体。アームが4本(カメラ1本＋器具3本が基本) |
| ビジョンカート | モニターと映像機器。助手や看護師はこの画面を見る |

術者は患者から離れたコンソールにいる。患者のそばには助手(ベッドサイドアシスタント)が立ち、器具の交換や吸引などを手で行う。

## 2. 術者の操作

- **両手コントローラ:** 握った手の動きがそのまま器具の先端に伝わる。器具の先端には手首のように曲がる関節がある(EndoWrist)。
- **動きの縮小(モーションスケーリング):** 手の動きと器具の動きの比を 1:1 / 2:1 / 3:1 から選べる。3:1 なら手を3cm動かして器具が1cm動く。
- **手ぶれ除去:** 人の手の細かい震え(8〜10Hz)をフィルタで取り除く。
- **クラッチ:** ペダルを踏んでいる間は器具が止まり、手だけを楽な位置に戻せる(マウスを持ち上げて置き直すのに近い)。
- **カメラ操作:** カメラ用ペダルを踏むと器具が固定され、両手の動きでカメラ(内視鏡)を動かす・寄せる・ピントを合わせる。**術者が自分でカメラを動かす**のが特徴。
- **ズーム:** 3D ハイビジョンで最大約10倍に拡大して見られる。
- **エネルギー:** 電気で切る・焼いて止血する器具があり、足のペダルで通電する。
- **4本目のアーム:** 器具アームが3本あるので、切り替えて使う(組織を持ち上げたまま保つ等)。
- **触覚:** 従来機は器具が組織を押す力が手に伝わらず、術者は「引っ張られた組織の見た目」で力加減を判断していた。2024年のダヴィンチ5で、力が手に返る機能(フォースフィードバック)が初めて入った。組織にかける力が最大43%減ったという報告がある。

## 3. 手術の流れ(前立腺全摘の例)

1. 全身麻酔。体位を取る(前立腺では頭を20度以上下げる)。
2. お腹に小さな穴を開けて筒(ポート)を入れる。おへそ付近にカメラ用、その周りに器具用3つと助手用1つ。
3. **ドッキング:** ペイシェントカートを患者に寄せ、アームをポートにつなぐ。
4. 術者がコンソールで手術をする: 剥がす(剥離)→ 血管を処理して止血 → 切除 → 取り出す → 縫ってつなぎ直す(吻合)。
5. アームを外し、穴を閉じる。

準備では、アームに清潔なカバー(ドレープ)をかける、カートや配線の位置を確かめるなど、看護師・臨床工学技士を含むチームで動く。

## 4. 練習方法(シミュレータ)

ダヴィンチ用の VR シミュレータには35以上の課題があり、次のように分かれる。

- 器具の手首の操作(物をつまんで所定の場所に置く 等)
- カメラとクラッチ(動く目標をカメラで追う 等)
- 4本目のアームの使い分け
- 針の扱いと運針・縫合
- エネルギーと剥離(細い血管を焼いてから切る 等)

採点は、完了時間・カメラを動かした回数や時間・器具の移動距離・組織に余計な力をかけたか などで行う。研修では「スコア90%以上」を合格の目安にしている例がある。

## 5. 日本での普及

- 日本で稼働するダヴィンチは800台超。前立腺全摘だけで年間2万件以上がロボット支援。
- 保険適用は前立腺から始まり、胃・大腸(結腸・直腸)・肝臓などに広がっている(2024年4月にも追加)。

## 6. 今の day16 にあるもの・ないもの(事実の対応のみ)

| 現場の要素 | day16 |
|---|---|
| 動きの縮小 1.5:1 / 2:1 / 3:1 | あり(実機は 1:1 / 2:1 / 3:1) |
| 両手コントローラ | なし(器具1本) |
| クラッチ | なし |
| カメラ操作・ズーム | なし(視野固定) |
| エネルギー(焼いて止血) | なし |
| 4本目のアーム | なし |
| 触覚がない(見た目で力加減) | 力の概念なし |
| 剥離・止血・切除・取り出し・縫合 | 切開・摘出・縫合の3つ |

## 出典

- [Traditional Control of the da Vinci Surgical System (Robotics, MDPI)](https://www.doi.org/10.3390/ROBOTICS8020031)
- [MHH: The control panel](https://www.mhh.de/en/urology/competences/robot-assisted-surgery/instrument-control-panel)
- [Robotic Applications in Cardiac Surgery (arXiv)](https://arxiv.org/pdf/cs/0412055)
- [看護roo! ロボット支援手術](https://www.kango-roo.com/learning/9204/)
- [京都第二赤十字病院 ロボット手術案内(PDF)](https://www.kyoto2.jrc.or.jp/wordpress/wp-content/uploads/info_robot.pdf)
- [岡山医療センター ダヴィンチの紹介(PDF)](https://www.okayamah.johas.go.jp/new0703/uploads/files/%E3%80%90%E5%A4%96%E7%A7%91%E3%80%91%E3%83%80%E3%83%B4%E3%82%A3%E3%83%B3%E3%83%81%E3%81%AE%E7%B4%B9%E4%BB%8B%20.pdf)
- [成田赤十字病院 ダヴィンチ](https://www.narita.jrc.or.jp/department/hinyokika/daVinci.html)
- [da Vinci Skills Simulator 研究 (PMC5737239)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5737239)
- [Robotic Surgery Curriculum (CMH)](https://gme.cmhshealth.org/about-us/residency-training/graduate-medical-education-gme-/residencies-fellowships/general-surgery/curriculum/robotics/)
- [RARP の手順 (PMC6071518)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6071518)
- [Intuitive: Force Feedback](https://www.intuitive.com/en-us/about-us/newsroom/force-feedback)
- [The Robot Report: da Vinci 5 の設計変更](https://www.therobotreport.com/the-intuitive-da-vinci-5s-top-design-changes-this-is-groundbreaking-for-robotic-surgery/)
- [メディカルノート ロボット手術](https://medicalnote.jp/nj_articles/250724-001-VJ)
- [国立がん研究センター東病院 ロボット手術](https://www.ncc.go.jp/jp/ncce/robot/index.html)
- [MONOist: 保険適用が拡大する da Vinci](https://monoist.itmedia.co.jp/mn/spv/2203/09/news059_2.html)
