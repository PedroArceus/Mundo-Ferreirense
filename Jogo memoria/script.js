const CARD_BLUEPRINTS = [
  { pairId: "pair-01", image: "assets/jogador-01.jpg" },
  { pairId: "pair-02", image: "assets/jogador-02.jpg" },
  { pairId: "pair-03", image: "assets/jogador-03.jpg" },
  { pairId: "pair-04", image: "assets/jogador-04.jpg" },
  { pairId: "pair-05", image: "assets/jogador-05.jpg" },
  { pairId: "pair-06", image: "assets/jogador-06.jpg" }
];

const TOTAL_PAIRS = CARD_BLUEPRINTS.length;
const RANKING_STORAGE_KEY = "curacao_memory_ranking";
const GAME_DURATION = 1 * 60;

const state = {
  firstCard: null,
  secondCard: null,
  lockBoard: false,
  moves: 0,
  matches: 0,
  seconds: 0,
  timerId: null,
  gameFinished: false,
  playerName: ""
};

const elements = {
  board: document.querySelector("#game-board"),
  timer: document.querySelector("#timer"),
  elapsed: document.querySelector("#elapsed"),
  moves: document.querySelector("#moves"),
  matches: document.querySelector("#matches"),
  status: document.querySelector("#status-text"),
  rankingList: document.querySelector("#ranking-list"),
  rankingNote: document.querySelector("#ranking-note"),
  restartButton: document.querySelector("#restart-button"),
  playButton: document.querySelector("#play-button"),
  menuButton: document.querySelector("#menu-button"),
  menuStage: document.querySelector("#menu-stage"),
  gameStage: document.querySelector("#game-stage"),
  modalRestart: document.querySelector("#modal-restart"),
  finishModal: document.querySelector("#finish-modal"),
  finalTime: document.querySelector("#final-time"),
  finishLabel: document.querySelector("#finish-label"),
  finishTitle: document.querySelector("#finish-title"),
  menuForm: document.querySelector("#menu-form"),
  menuPlayerName: document.querySelector("#menu-player-name"),
  finishRankingList: document.querySelector("#finish-ranking-list")
};

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateStatus(message) {
  elements.status.textContent = message;
}

function showMenu() {
  elements.menuStage.classList.remove("is-hidden");
  elements.gameStage.classList.add("is-hidden");
  updateStatus("Clique em Jogar para iniciar.");
}

function showGame() {
  elements.menuStage.classList.add("is-hidden");
  elements.gameStage.classList.remove("is-hidden");
}

function supportsLocalStorage() {
  try {
    const key = "__curacao_storage_probe__";
    localStorage.setItem(key, "ok");
    const ok = localStorage.getItem(key) === "ok";
    localStorage.removeItem(key);
    return ok;
  } catch (error) {
    return false;
  }
}

function loadRanking() {
  try {
    const savedValue = localStorage.getItem(RANKING_STORAGE_KEY);

    if (!savedValue) {
      return [];
    }

    const parsed = JSON.parse(savedValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => typeof entry?.name === "string" && Number.isFinite(entry?.seconds))
      .sort((a, b) => a.seconds - b.seconds)
      .slice(0, 5);
  } catch (error) {
    return [];
  }
}

function saveRanking(entries) {
  try {
    localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(entries.slice(0, 5)));
  } catch (error) {
    console.warn("Não foi possível salvar o ranking no localStorage.", error);
  }
}

function renderRankingList(container, ranking) {
  const slots = Array.from({ length: 5 }, (_, index) => ranking[index] ?? null);

  container.innerHTML = slots
    .map((entry, index) => {
      const place = `${index + 1}º`;
      const name = entry ? entry.name : "---";
      const time = entry ? formatTime(entry.seconds) : "--:--";
      return `<li>${place} - ${name} - ${time}</li>`;
    })
    .join("");
}

function renderRanking() {
  const ranking = loadRanking();
  renderRankingList(elements.rankingList, ranking);
}

function renderFinishModalRanking() {
  const ranking = loadRanking();
  renderRankingList(elements.finishRankingList, ranking);
}

function sanitizeName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 18);
}

function createDeck() {
  const duplicatedCards = CARD_BLUEPRINTS.flatMap((card, index) => [
    {
      id: `${card.pairId}-a-${index}`,
      pairId: card.pairId,
      image: card.image
    },
    {
      id: `${card.pairId}-b-${index}`,
      pairId: card.pairId,
      image: card.image
    }
  ]);

  return shuffle(duplicatedCards);
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function buildCardMarkup(card) {
  return `
    <span class="card__inner">
      <span class="card__face card__face--back">
        <span class="card__crest" aria-hidden="true">
          <span class="card__crest-line"></span>
        </span>
      </span>
      <span class="card__face card__face--front">
        <img class="card__image" src="${card.image}" alt="Jogador" loading="lazy" decoding="async">
      </span>
    </span>
  `;
}

function renderBoard() {
  const deck = createDeck();
  elements.board.innerHTML = "";

  for (const card of deck) {
    const button = document.createElement("button");
    button.className = "card";
    button.type = "button";
    button.dataset.cardId = card.id;
    button.dataset.pairId = card.pairId;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", "Carta oculta");
    button.innerHTML = buildCardMarkup(card);
    button.addEventListener("click", handleCardClick);
    elements.board.append(button);
  }
}

function startTimer() {
  stopTimer();
  elements.timer.textContent = formatTime(GAME_DURATION);
  elements.elapsed.textContent = formatTime(state.seconds);

  state.timerId = window.setInterval(() => {
    state.seconds += 1;
    const remaining = Math.max(GAME_DURATION - state.seconds, 0);
    elements.timer.textContent = formatTime(remaining);
    elements.elapsed.textContent = formatTime(state.seconds);

    if (remaining === 0) {
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function resetTurn() {
  state.firstCard = null;
  state.secondCard = null;
}

function updateScoreboard() {
  elements.moves.textContent = String(state.moves).padStart(2, "0");
  elements.matches.textContent = `${state.matches}/${TOTAL_PAIRS}`;
}

function flipCard(card) {
  card.classList.add("is-flipped");
  card.setAttribute("aria-label", "Carta revelada");
}

function hideCard(card) {
  card.classList.remove("is-flipped", "is-wrong");
  card.setAttribute("aria-label", "Carta oculta");
}

function lockMatchedCards(firstCard, secondCard) {
  firstCard.classList.add("is-matched");
  secondCard.classList.add("is-matched");
  firstCard.setAttribute("aria-label", "Par encontrado");
  secondCard.setAttribute("aria-label", "Par encontrado");
}

function finishGame() {
  state.gameFinished = true;
  stopTimer();
  elements.board.classList.add("board--complete");
  elements.finalTime.textContent = formatTime(state.seconds);
  elements.finishLabel.textContent = "Tempo final";
  elements.finishTitle.textContent = "A arena respondeu ao seu ritmo.";
  elements.finishModal.classList.add("is-visible");
  elements.finishModal.setAttribute("aria-hidden", "false");

  if (supportsLocalStorage() && state.playerName) {
    savePlayerScore(state.playerName);
    updateStatus(`Tempo salvo no ranking para ${state.playerName}.`);
  } else {
    updateStatus("Todos os pares encontrados.");
  }

  renderFinishModalRanking();
}

function handleTimeout() {
  if (state.gameFinished) {
    return;
  }

  state.gameFinished = true;
  state.lockBoard = true;
  stopTimer();
  elements.finalTime.textContent = formatTime(state.seconds);
  elements.finishLabel.textContent = "Seu tempo";
  elements.finishTitle.textContent = "Game over. Tempo esgotado.";
  elements.finishModal.classList.add("is-visible");
  elements.finishModal.setAttribute("aria-hidden", "false");
  renderFinishModalRanking();
  updateStatus("Tempo esgotado. Volte ao menu para reiniciar.");
}

function handleMatch() {
  lockMatchedCards(state.firstCard, state.secondCard);
  state.matches += 1;
  updateScoreboard();
  updateStatus("Par confirmado. Continue pressionando o ritmo.");

  window.setTimeout(() => {
    const allPairsFound = state.matches === TOTAL_PAIRS;
    resetTurn();
    state.lockBoard = false;

    if (allPairsFound) {
      finishGame();
    }
  }, 420);
}

function handleMismatch() {
  state.firstCard.classList.add("is-wrong");
  state.secondCard.classList.add("is-wrong");
  updateStatus("Não formou par. As cartas estão voltando.");

  window.setTimeout(() => {
    hideCard(state.firstCard);
    hideCard(state.secondCard);
    resetTurn();
    state.lockBoard = false;
  }, 920);
}

function handleCardClick(event) {
  const selectedCard = event.currentTarget;

  if (
    state.lockBoard ||
    state.gameFinished ||
    selectedCard === state.firstCard ||
    selectedCard.classList.contains("is-flipped") ||
    selectedCard.classList.contains("is-matched")
  ) {
    return;
  }

  flipCard(selectedCard);

  if (!state.firstCard) {
    state.firstCard = selectedCard;
    updateStatus("Primeira carta revelada. Encontre a combinação.");
    return;
  }

  state.secondCard = selectedCard;
  state.lockBoard = true;
  state.moves += 1;
  updateScoreboard();

  const isMatch = state.firstCard.dataset.pairId === state.secondCard.dataset.pairId;

  if (isMatch) {
    handleMatch();
  } else {
    handleMismatch();
  }
}

function closeModal() {
  elements.finishModal.classList.remove("is-visible");
  elements.finishModal.setAttribute("aria-hidden", "true");
}

function resetState() {
  stopTimer();
  state.firstCard = null;
  state.secondCard = null;
  state.lockBoard = false;
  state.moves = 0;
  state.matches = 0;
  state.seconds = 0;
  state.gameFinished = false;
}

function startGame() {
  closeModal();
  resetState();
  renderBoard();
  updateScoreboard();
  elements.timer.textContent = formatTime(GAME_DURATION);
  elements.elapsed.textContent = formatTime(0);
  elements.finalTime.textContent = formatTime(0);
  elements.board.classList.remove("board--complete");
  updateStatus("Partida iniciada. Revele a primeira carta.");
  startTimer();
}

function savePlayerScore(playerName) {
  const ranking = loadRanking();
  ranking.push({
    name: playerName || "Visitante",
    seconds: state.seconds
  });

  ranking.sort((a, b) => a.seconds - b.seconds);
  saveRanking(ranking.slice(0, 5));
  renderRanking();
}

function initializeRanking() {
  if (!supportsLocalStorage()) {
    elements.rankingNote.textContent = "localStorage indisponível. O ranking pode não persistir.";
  } else {
    elements.rankingNote.textContent = "Ranking salvo no navegador (localStorage).";
  }

  renderRanking();
}

function handlePlay(event) {
  event.preventDefault();

  const name = sanitizeName(elements.menuPlayerName.value);
  if (!name) {
    elements.menuPlayerName.focus();
    return;
  }

  state.playerName = name;
  showGame();
  startGame();
}

function handleMenuReturn() {
  closeModal();
  stopTimer();
  showMenu();
}

elements.restartButton.addEventListener("click", startGame);
elements.modalRestart.addEventListener("click", () => {
  closeModal();
  stopTimer();
  showMenu();
});
elements.menuForm.addEventListener("submit", handlePlay);
elements.menuButton.addEventListener("click", handleMenuReturn);

initializeRanking();
showMenu();
