import { useState, useEffect, useRef } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomUniqueNumbers(n = 7, min = 1, max = 99) {
  const set = new Set();
  while (set.size < n) set.add(Math.floor(Math.random() * (max - min + 1)) + min);
  return [...set];
}

function isSorted(arr) {
  for (let i = 0; i < arr.length - 1; i++) if (arr[i] > arr[i + 1]) return false;
  return true;
}

// ── AI logic ──────────────────────────────────────────────────────────────────
// AI keeps a knowledge base: for each pair (i,j) it knows if playerNums[i] < playerNums[j]
class AIBrain {
  constructor() {
    this.knowledge = {}; // "i,j" -> true means i < j
    this.askedPairs = new Set();
    this.swapLog = []; // swaps AI has applied to its mental model of player's array
    // AI's mental permutation of player's numbers (starts as unknown = null array)
    this.mentalOrder = [0, 1, 2, 3, 4, 5, 6]; // indices into playerNums
    this.confidence = Array(7).fill(false); // per position: do we know what's there?
  }

  // record a comparison result: playerNums[posA] > playerNums[posB] = result
  recordComparison(posA, posB, aGreater) {
    if (aGreater) {
      this.knowledge[`${posA},${posB}`] = false; // posA > posB => posA NOT less than posB
      this.knowledge[`${posB},${posA}`] = true;  // posB < posA
    } else {
      this.knowledge[`${posA},${posB}`] = true;  // posA < posB
      this.knowledge[`${posB},${posA}`] = false;
    }
  }

  knows(i, j) { return this.knowledge[`${i},${j}`] !== undefined; }
  iLessJ(i, j) { return this.knowledge[`${i},${j}`] === true; }

  // find next unknown pair to ask about
  nextQuestion() {
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        const key = `${i},${j}`;
        if (!this.askedPairs.has(key)) {
          this.askedPairs.add(key);
          return { posA: i, posB: j };
        }
      }
    }
    return null;
  }

  // try to determine a swap that brings player closer to sorted
  // returns {posA, posB} to swap or null
  findBestSwap() {
    // build adjacency from knowledge and try to find an inversion
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        // if we know position i should be AFTER position j (i > j in value)
        if (this.knows(i, j) && !this.iLessJ(i, j)) {
          return { posA: i, posB: j };
        }
      }
    }
    return null;
  }

  // check if AI believes player array is sorted
  believesSorted() {
    for (let i = 0; i < 6; i++) {
      if (!this.knows(i, i + 1) || !this.iLessJ(i, i + 1)) return false;
    }
    return true;
  }

  // decide next move
  decideMove() {
    // if we believe it's sorted, declare
    if (this.believesSorted()) return { type: "declare" };
    // if we can make a helpful swap, do it
    const swap = this.findBestSwap();
    if (swap && Math.random() < 0.7) return { type: "swap", ...swap };
    // otherwise ask a question
    const q = this.nextQuestion();
    if (q) return { type: "question", ...q };
    // fallback: declare (might be wrong)
    return { type: "declare" };
  }
}

// ── component ─────────────────────────────────────────────────────────────────
const PHASE = {
  SETUP: "setup",
  PLAYING: "playing",
  GAMEOVER: "gameover",
};

export default function App() {
  const [phase, setPhase] = useState(PHASE.SETUP);
  const [playerInput, setPlayerInput] = useState(Array(7).fill(""));
  const [inputError, setInputError] = useState("");

  // player's numbers (shuffled, hidden from AI)
  const [playerNums, setPlayerNums] = useState([]);
  // AI's numbers (shuffled, hidden from player)
  const [aiNums, setAiNums] = useState([]);

  const [turn, setTurn] = useState("player"); // "player" | "ai"
  const [winner, setWinner] = useState(null); // "player" | "ai"

  // player's action state
  const [actionMode, setActionMode] = useState(null); // "question" | "swap" | null
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [questionResult, setQuestionResult] = useState(null); // {text, answer}

  const [log, setLog] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);

  const brainRef = useRef(new AIBrain());
  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function addLog(entry) {
    setLog(prev => [...prev, entry]);
  }

  // ── SETUP ──
  function handleInputChange(i, val) {
    const arr = [...playerInput];
    arr[i] = val;
    setPlayerInput(arr);
  }

  function startGame() {
    const nums = playerInput.map(v => parseInt(v.trim(), 10));
    if (nums.some(isNaN)) return setInputError("Все 7 чисел должны быть целыми!");
    if (nums.some(n => n < 1 || n > 99)) return setInputError("Числа должны быть от 1 до 99!");
    if (new Set(nums).size !== 7) return setInputError("Числа не должны повторяться!");
    setInputError("");

    const shuffledPlayer = shuffle(nums);
    const aiNumbers = randomUniqueNumbers(7);
    const shuffledAi = shuffle(aiNumbers);

    setPlayerNums(shuffledPlayer);
    setAiNums(shuffledAi);
    brainRef.current = new AIBrain();
    setLog([{ type: "info", text: "🎮 Игра началась! Ваш ход." }]);
    setTurn("player");
    setPhase(PHASE.PLAYING);
    setActionMode(null);
    setSelectedPositions([]);
    setQuestionResult(null);
  }

  // ── PLAYER ACTIONS ──
  function handlePositionClick(pos) {
    if (turn !== "player" || !actionMode) return;

    if (actionMode === "question") {
      if (selectedPositions.includes(pos)) {
        setSelectedPositions(prev => prev.filter(p => p !== pos));
        return;
      }
      if (selectedPositions.length < 2) {
        const next = [...selectedPositions, pos];
        setSelectedPositions(next);
        if (next.length === 2) {
          askQuestion(next[0], next[1]);
        }
      }
    }

    if (actionMode === "swap") {
      if (selectedPositions.includes(pos)) {
        setSelectedPositions(prev => prev.filter(p => p !== pos));
        return;
      }
      if (selectedPositions.length < 2) {
        const next = [...selectedPositions, pos];
        setSelectedPositions(next);
        if (next.length === 2) {
          doPlayerSwap(next[0], next[1]);
        }
      }
    }
  }

  function askQuestion(posA, posB) {
    const a = aiNums[posA], b = aiNums[posB];
    const aGreater = a > b;
    const answer = aGreater ? "Да" : "Нет";
    const text = `Позиция ${posA + 1} > Позиция ${posB + 1}?`;
    setQuestionResult({ text, answer });
    addLog({ type: "player", text: `❓ ${text} → ${answer}` });
    brainRef.current.recordComparison(posA, posB, aGreater);
    setActionMode(null);
    setSelectedPositions([]);
    endPlayerTurn();
  }

  function doPlayerSwap(posA, posB) {
    setAiNums(prev => {
      const next = [...prev];
      [next[posA], next[posB]] = [next[posB], next[posA]];
      return next;
    });
    addLog({ type: "player", text: `🔄 Меняю позиции ${posA + 1} и ${posB + 1} у ИИ` });
    setActionMode(null);
    setSelectedPositions([]);
    endPlayerTurn();
  }

  function playerDeclare() {
    if (isSorted(aiNums)) {
      setWinner("player");
      addLog({ type: "win", text: "🏆 Вы объявили — числа упорядочены! Вы победили!" });
      setPhase(PHASE.GAMEOVER);
    } else {
      setWinner("ai");
      addLog({ type: "lose", text: "💀 Вы объявили — но числа НЕ упорядочены! Вы проиграли!" });
      setPhase(PHASE.GAMEOVER);
    }
  }

  function endPlayerTurn() {
    setQuestionResult(null);
    setTurn("ai");
    setTimeout(doAiTurn, 900);
  }

  // ── AI TURN ──
  function doAiTurn() {
    setAiThinking(true);
    setTimeout(() => {
      const brain = brainRef.current;
      const move = brain.decideMove();

      if (move.type === "question") {
        const a = playerNums[move.posA], b = playerNums[move.posB];
        const aGreater = a > b;
        brain.recordComparison(move.posA, move.posB, aGreater);
        const answer = aGreater ? "Да" : "Нет";
        addLog({ type: "ai", text: `🤖 ИИ спрашивает: Позиция ${move.posA + 1} > Позиция ${move.posB + 1}? → ${answer}` });
      } else if (move.type === "swap") {
        setPlayerNums(prev => {
          const next = [...prev];
          [next[move.posA], next[move.posB]] = [next[move.posB], next[move.posA]];
          // update brain knowledge after swap
          const newKnowledge = {};
          for (const key of Object.keys(brain.knowledge)) {
            const [i, j] = key.split(",").map(Number);
            let ni = i, nj = j;
            if (i === move.posA) ni = move.posB;
            else if (i === move.posB) ni = move.posA;
            if (j === move.posA) nj = move.posB;
            else if (j === move.posB) nj = move.posA;
            newKnowledge[`${ni},${nj}`] = brain.knowledge[key];
          }
          brain.knowledge = newKnowledge;
          return next;
        });
        addLog({ type: "ai", text: `🤖 ИИ меняет позиции ${move.posA + 1} и ${move.posB + 1} у вас` });
      } else if (move.type === "declare") {
        // check against actual playerNums (use ref trick via callback)
        setPlayerNums(prev => {
          if (isSorted(prev)) {
            setWinner("ai");
            addLog({ type: "lose", text: "🤖 ИИ объявил — числа упорядочены! ИИ победил!" });
            setPhase(PHASE.GAMEOVER);
          } else {
            setWinner("player");
            addLog({ type: "win", text: "🤖 ИИ объявил — но числа НЕ упорядочены! Вы победили!" });
            setPhase(PHASE.GAMEOVER);
          }
          return prev;
        });
        setAiThinking(false);
        return;
      }

      setAiThinking(false);
      setTurn("player");
    }, 1200);
  }

  // ── RENDER ──
  const isPlayerTurn = turn === "player" && phase === PHASE.PLAYING;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e8e0d4",
      fontFamily: "'Courier New', monospace",
      padding: "20px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; }
        .title { font-family: 'Russo One', sans-serif; }
        .mono { font-family: 'Share Tech Mono', monospace; }
        .btn {
          background: transparent;
          border: 1px solid #555;
          color: #e8e0d4;
          padding: 8px 18px;
          cursor: pointer;
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          transition: all 0.15s;
          letter-spacing: 1px;
        }
        .btn:hover { border-color: #c8a96e; color: #c8a96e; }
        .btn.active { border-color: #c8a96e; background: rgba(200,169,110,0.12); color: #c8a96e; }
        .btn.danger { border-color: #c0392b; color: #c0392b; }
        .btn.danger:hover { background: rgba(192,57,43,0.15); }
        .btn.success { border-color: #27ae60; color: #27ae60; }
        .btn.success:hover { background: rgba(39,174,96,0.15); }
        .pos-btn {
          width: 52px; height: 52px;
          border: 1px solid #333;
          background: #111118;
          color: #e8e0d4;
          cursor: pointer;
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          transition: all 0.15s;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column;
          gap: 2px;
        }
        .pos-btn:hover { border-color: #c8a96e; }
        .pos-btn.selected { border-color: #c8a96e; background: rgba(200,169,110,0.15); }
        .pos-btn.first-selected { border-color: #e74c3c; background: rgba(231,76,60,0.15); }
        .number-input {
          background: #111118;
          border: 1px solid #333;
          color: #e8e0d4;
          padding: 8px 12px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 16px;
          width: 64px;
          text-align: center;
          outline: none;
        }
        .number-input:focus { border-color: #c8a96e; }
        .log-entry { padding: 4px 0; font-size: 12px; border-bottom: 1px solid #1a1a22; }
        .log-entry.player { color: #7ec8e3; }
        .log-entry.ai { color: #e8a87c; }
        .log-entry.win { color: #27ae60; font-weight: bold; }
        .log-entry.lose { color: #c0392b; font-weight: bold; }
        .log-entry.info { color: #888; }
        .reveal-card {
          background: #111118;
          border: 1px solid #333;
          padding: 6px 10px;
          min-width: 44px;
          text-align: center;
          font-family: 'Share Tech Mono', monospace;
        }
        .sorted-highlight { border-color: #27ae60 !important; color: #27ae60; }
      `}</style>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 className="title" style={{ fontSize: 28, letterSpacing: 4, color: "#c8a96e", margin: 0 }}>
          ЧИСЛОВАЯ ДУЭЛЬ
        </h1>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: 3, marginTop: 4 }}>
          УПОРЯДОЧИ ЧИСЛА ПРОТИВНИКА
        </div>
      </div>

      {/* ── SETUP PHASE ── */}
      {phase === PHASE.SETUP && (
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={{ border: "1px solid #222", padding: 24, background: "#0d0d14" }}>
            <div style={{ marginBottom: 16, color: "#c8a96e", fontSize: 13, letterSpacing: 2 }}>
              ВВЕДИТЕ 7 ЧИСЕЛ (1–99, без повторений)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {playerInput.map((v, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>#{i + 1}</div>
                  <input
                    className="number-input"
                    value={v}
                    onChange={e => handleInputChange(i, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") startGame(); }}
                    maxLength={2}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
            {inputError && (
              <div style={{ color: "#c0392b", fontSize: 12, marginBottom: 12 }}>{inputError}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn success" onClick={startGame}>НАЧАТЬ ИГРУ</button>
              <button className="btn" onClick={() => {
                const r = randomUniqueNumbers(7);
                setPlayerInput(r.map(String));
              }}>🎲 СЛУЧАЙНЫЕ</button>
            </div>
            <div style={{ marginTop: 20, fontSize: 11, color: "#444", lineHeight: 1.8 }}>
              <div>— Ваши числа будут перемешаны случайно</div>
              <div>— ИИ загадает свои 7 чисел</div>
              <div>— Задавайте вопросы и меняйте позиции</div>
              <div>— Первый кто упорядочит числа врага — победит</div>
            </div>
          </div>
        </div>
      )}

      {/* ── PLAYING PHASE ── */}
      {phase === PHASE.PLAYING && (
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {/* Turn indicator */}
          <div style={{
            textAlign: "center", marginBottom: 16, padding: "8px 0",
            borderBottom: "1px solid #1a1a22",
            color: turn === "player" ? "#7ec8e3" : "#e8a87c",
            fontSize: 13, letterSpacing: 3,
          }}>
            {aiThinking ? "⏳ ИИ ДУМАЕТ..." : turn === "player" ? "▶ ВАШ ХОД" : "▶ ХОД ИИ"}
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {/* Left: boards */}
            <div style={{ flex: 1, minWidth: 280 }}>

              {/* AI's board (player acts on this) */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#e8a87c", letterSpacing: 2, marginBottom: 8 }}>
                  🤖 ЧИСЛА ИИ {isPlayerTurn && actionMode ? "(кликни позицию)" : ""}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {aiNums.map((_, i) => {
                    const sel = selectedPositions.includes(i);
                    const isFirst = selectedPositions[0] === i;
                    return (
                      <button
                        key={i}
                        className={`pos-btn ${sel ? (isFirst ? "first-selected" : "selected") : ""}`}
                        onClick={() => handlePositionClick(i)}
                        style={{ cursor: isPlayerTurn && actionMode ? "pointer" : "default" }}
                      >
                        <span style={{ fontSize: 9, color: "#555" }}>#{i + 1}</span>
                        <span style={{ fontSize: 18 }}>?</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Player's board */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#7ec8e3", letterSpacing: 2, marginBottom: 8 }}>
                  👤 ВАШИ ЧИСЛА
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {playerNums.map((n, i) => (
                    <div key={i} style={{
                      width: 52, height: 52,
                      border: "1px solid #222",
                      background: "#0d0d14",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexDirection: "column", gap: 2,
                    }}>
                      <span style={{ fontSize: 9, color: "#444" }}>#{i + 1}</span>
                      <span className="mono" style={{ fontSize: 16, color: "#7ec8e3" }}>{n}</span>
                    </div>
                  ))}
                </div>
                {isSorted(playerNums) && (
                  <div style={{ fontSize: 11, color: "#27ae60", marginTop: 6 }}>
                    ✓ ИИ упорядочил ваши числа!
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {isPlayerTurn && !aiThinking && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className={`btn ${actionMode === "question" ? "active" : ""}`}
                    onClick={() => { setActionMode(actionMode === "question" ? null : "question"); setSelectedPositions([]); setQuestionResult(null); }}
                  >
                    ❓ ВОПРОС
                  </button>
                  <button
                    className={`btn ${actionMode === "swap" ? "active" : ""}`}
                    onClick={() => { setActionMode(actionMode === "swap" ? null : "swap"); setSelectedPositions([]); setQuestionResult(null); }}
                  >
                    🔄 ОБМЕН
                  </button>
                  <button className="btn success" onClick={playerDeclare}>
                    🏆 ВСЁ УПОРЯДОЧЕНО
                  </button>
                </div>
              )}

              {actionMode && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#c8a96e" }}>
                  {actionMode === "question" && `Выбери 2 позиции у ИИ для сравнения (выбрано: ${selectedPositions.length}/2)`}
                  {actionMode === "swap" && `Выбери 2 позиции у ИИ для обмена (выбрано: ${selectedPositions.length}/2)`}
                </div>
              )}

              {questionResult && (
                <div style={{
                  marginTop: 10, padding: "8px 12px",
                  border: "1px solid #c8a96e", background: "rgba(200,169,110,0.08)",
                  fontSize: 13,
                }}>
                  <span style={{ color: "#888" }}>{questionResult.text}</span>
                  {" "}<span style={{ color: "#c8a96e", fontWeight: "bold" }}>{questionResult.answer}</span>
                </div>
              )}
            </div>

            {/* Right: log */}
            <div style={{ width: 220 }}>
              <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginBottom: 8 }}>ЖУРНАЛ</div>
              <div style={{
                height: 280, overflowY: "auto",
                border: "1px solid #1a1a22", padding: 8,
                background: "#080810",
              }}>
                {log.map((entry, i) => (
                  <div key={i} className={`log-entry ${entry.type}`}>{entry.text}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GAMEOVER PHASE ── */}
      {phase === PHASE.GAMEOVER && (
        <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            border: `1px solid ${winner === "player" ? "#27ae60" : "#c0392b"}`,
            padding: 32, background: "#0d0d14",
          }}>
            <div className="title" style={{
              fontSize: 36,
              color: winner === "player" ? "#27ae60" : "#c0392b",
              marginBottom: 12,
              letterSpacing: 4,
            }}>
              {winner === "player" ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
            </div>

            <div style={{ marginBottom: 20, fontSize: 13, color: "#888" }}>
              {log[log.length - 1]?.text}
            </div>

            {/* Reveal */}
            <div style={{ display: "flex", gap: 32, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "#7ec8e3", letterSpacing: 2, marginBottom: 8 }}>
                  👤 ВАШИ ЧИСЛА
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {playerNums.map((n, i) => (
                    <div key={i} className={`reveal-card ${isSorted(playerNums) ? "sorted-highlight" : ""}`}>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#e8a87c", letterSpacing: 2, marginBottom: 8 }}>
                  🤖 ЧИСЛА ИИ
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {aiNums.map((n, i) => (
                    <div key={i} className={`reveal-card ${isSorted(aiNums) ? "sorted-highlight" : ""}`}>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button className="btn success" onClick={() => {
              setPhase(PHASE.SETUP);
              setPlayerInput(Array(7).fill(""));
              setLog([]);
              setWinner(null);
              setActionMode(null);
              setSelectedPositions([]);
              setQuestionResult(null);
            }}>
              ИГРАТЬ СНОВА
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
