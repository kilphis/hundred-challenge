;;; コイン集めゲーム (Common Lisp / SBCL)
;;; 実行:  sbcl --script coin-game.lisp
;;;
;;; Lisp の読み方メモ
;;;   (f a b)    … 関数 f に a と b を渡して呼ぶ。+ や if も同じ形。  (+ 1 2) → 3
;;;   '(1 2 3)   … リスト。先頭の ' は「計算せず、そのままデータとして扱う」印。
;;;   (cons x y) … x と y のペアを作る。(car p) で x、(cdr p) で y を取り出す。
;;;   (defun 名前 (引数...) 本体)  … 関数を定義する。本体の最後の式が返り値。
;;;   (let ((a 1) (b 2)) ...)      … 一時的な変数 a, b を作る。

(defparameter *width* 9)
(defparameter *height* 7)
(defparameter *coin-count* 5)

;;; ゲームの状態。マスの位置は (x . y) のペアで持つ。
;;; make-game で作ると、game-player / game-coins / game-enemies で中身を読める。
(defstruct game player coins enemies)

(defun same-p (a b) (equal a b))

(defun at-p (point points)
  "point が points(リスト)の中にあるか"
  (member point points :test #'equal))

(defun inside-p (p)
  (and (<= 0 (car p) (1- *width*))
       (<= 0 (cdr p) (1- *height*))))

;;; --- 動き -------------------------------------------------------------

(defun move-player (p key)
  "押したキーに応じて p の次の位置を返す(盤の外には出ない)"
  (let ((new (case key
               (#\w (cons (car p) (1- (cdr p))))
               (#\s (cons (car p) (1+ (cdr p))))
               (#\a (cons (1- (car p)) (cdr p)))
               (#\d (cons (1+ (car p)) (cdr p)))
               (t p))))
    (if (inside-p new) new p)))

(defun step-toward (from to)
  "from を to に向かって1歩だけ進める(遠い方の軸を優先)"
  (let ((dx (- (car to) (car from)))
        (dy (- (cdr to) (cdr from))))
    (if (>= (abs dx) (abs dy))
        (cons (+ (car from) (signum dx)) (cdr from))
        (cons (car from) (+ (cdr from) (signum dy))))))

(defun next-state (g key turn)
  "1手ぶん進めた新しい状態を返す。敵は偶数ターンだけ動く。"
  (let* ((player (move-player (game-player g) key))
         (coins (remove player (game-coins g) :test #'equal))
         (enemies (if (evenp turn)
                      (mapcar (lambda (e) (step-toward e player)) (game-enemies g))
                      (game-enemies g))))
    (make-game :player player :coins coins :enemies enemies)))

;;; --- 表示 -------------------------------------------------------------

(defun cell-char (g p)
  (cond ((at-p p (game-enemies g)) "X ")
        ((same-p p (game-player g)) "@ ")
        ((at-p p (game-coins g)) "$ ")
        (t ". ")))

(defun draw (g)
  (dotimes (y *height*)
    (dotimes (x *width*)
      (princ (cell-char g (cons x y))))
    (terpri)))

;;; --- 初期状態 ---------------------------------------------------------

(defun random-coins (n taken)
  "taken(使用済みのマス)を避けて n 個のコインの位置を作る"
  (let ((coins '()))
    (loop while (< (length coins) n)
          do (let ((p (cons (random *width*) (random *height*))))
               (unless (or (at-p p coins) (at-p p taken))
                 (push p coins))))
    coins))

(defun coins-from-env ()
  "テスト用: 環境変数 COINS に ((3 . 1) (5 . 2)) と書くとコインの位置を固定できる。
read-from-string は文字列を Lisp のデータとして読む(コード = データ)。"
  (let ((s (sb-ext:posix-getenv "COINS")))
    (and s (read-from-string s))))

(defun new-game ()
  (let ((player (cons 0 0))
        (enemies (list (cons (1- *width*) (1- *height*))
                       (cons (1- *width*) 0)
                       (cons 0 (1- *height*)))))
    (make-game :player player
               :enemies enemies
               :coins (or (coins-from-env)
                          (random-coins *coin-count* (cons player enemies))))))

;;; --- ゲームループ -----------------------------------------------------
;;; ループは「自分自身を呼ぶ」再帰で書く。状態 g を書き換えず、新しい状態を次に渡す。

(defun read-key ()
  (let ((line (read-line *standard-input* nil nil)))
    (cond ((null line) #\q)
          ((zerop (length line)) #\space)
          (t (char-downcase (char line 0))))))

(defun play (g turn)
  (fresh-line)
  (format t "~%コイン残り ~a   (w a s d + Enter で移動, q でやめる)~%" (length (game-coins g)))
  (draw g)
  (cond ((at-p (game-player g) (game-enemies g))
         (format t "~%X につかまった。ゲームオーバー (~a手)~%" turn))
        ((null (game-coins g))
         (format t "~%全部集めた! クリア (~a手)~%" turn))
        (t
         (princ "> ")
         (finish-output)
         (let ((key (read-key)))
           (if (char= key #\q)
               (format t "~%やめました。~%")
               (play (next-state g key (1+ turn)) (1+ turn)))))))

(setf *random-state* (make-random-state t))
(play (new-game) 0)
