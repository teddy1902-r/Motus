(() => {
  const LONGUEUR_MOT = 10;
  const MAX_ESSAIS = 6;
  const API_URL = "https://motus-api.teddysegura-ts.workers.dev";

  const URL_DICTIONNAIRE =
    "https://git.antoineve.me/AntoineVe/wgamesolv/raw/commit/0e6ce6e249b79fad9b3a0f4beeb84b4cec146cce/fr_10letters.json";

  let motsAutorises = new Set();
  let dictionnaireCharge = false;
  let essais = [];
  let motActuel = "";
  let jeuTermine = false;
  let validationEnCours = false;
  const etatClavier = {};

  const board = document.getElementById("board");
  const keyboard = document.getElementById("keyboard");
  const message = document.getElementById("message");
  const attemptsDisplay = document.getElementById("attempts");
  const restartBtn = document.getElementById("restartBtn");

  function normaliserMot(mot) {
    return String(mot)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  async function chargerDictionnaire() {
    try {
      const reponse = await fetch(URL_DICTIONNAIRE, { cache: "no-store" });
      if (!reponse.ok) throw new Error("Dictionnaire indisponible");

      const mots = await reponse.json();
      motsAutorises = new Set(
        mots.map(normaliserMot).filter(mot => /^[A-Z]{10}$/.test(mot))
      );
      dictionnaireCharge = true;
    } catch (erreur) {
      console.error("Impossible de charger le dictionnaire :", erreur);
      dictionnaireCharge = false;
      motsAutorises = new Set();
    }
  }

  function creerGrille() {
    board.innerHTML = "";

    for (let ligne = 0; ligne < MAX_ESSAIS; ligne++) {
      const row = document.createElement("div");
      row.className = "row";

      for (let colonne = 0; colonne < LONGUEUR_MOT; colonne++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = ligne;
        cell.dataset.col = colonne;
        row.appendChild(cell);
      }

      board.appendChild(row);
    }
  }

  function creerClavier() {
    keyboard.innerHTML = "";
    const lignes = [
      ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
      ["W", "X", "C", "V", "B", "N"]
    ];

    lignes.forEach((ligne, index) => {
      const row = document.createElement("div");
      row.className = "keyboard-row";

      if (index === 2) row.appendChild(creerTouche("⌫", "BACKSPACE", true));
      ligne.forEach(lettre => row.appendChild(creerTouche(lettre, lettre)));
      if (index === 2) row.appendChild(creerTouche("ENTRÉE", "ENTER", true));

      keyboard.appendChild(row);
    });
  }

  function creerTouche(texte, valeur, large = false) {
    const touche = document.createElement("button");
    touche.className = large ? "key wide" : "key";
    touche.textContent = texte;
    touche.dataset.key = valeur;
    touche.addEventListener("click", event => {
      if (!jeuTermine && !validationEnCours) {
        traiterTouche(event.currentTarget.dataset.key);
      }
    });
    return touche;
  }

  document.addEventListener("keydown", event => {
    if (jeuTermine || validationEnCours) return;

    const touche = event.key.toUpperCase();
    if (/^[A-Z]$/.test(touche)) return traiterTouche(touche);
    if (event.key === "Backspace") return traiterTouche("BACKSPACE");
    if (event.key === "Enter") traiterTouche("ENTER");
  });

  function traiterTouche(touche) {
    if (/^[A-Z]$/.test(touche)) {
      if (motActuel.length < LONGUEUR_MOT) {
        motActuel += touche;
        afficherMotActuel();
      }
      return;
    }

    if (touche === "BACKSPACE") {
      motActuel = motActuel.slice(0, -1);
      afficherMotActuel();
      return;
    }

    if (touche === "ENTER") validerMot();
  }

  function afficherMotActuel() {
    const ligne = essais.length;
    const cellules = board.children[ligne]?.children;
    if (!cellules) return;

    for (let i = 0; i < LONGUEUR_MOT; i++) {
      cellules[i].textContent = motActuel[i] || "";
      cellules[i].classList.toggle("filled", Boolean(motActuel[i]));
    }
  }

  async function validerMot() {
    if (validationEnCours || jeuTermine) return;

    if (motActuel.length !== LONGUEUR_MOT) {
      afficherMessage("Le mot doit contenir exactement 10 lettres.", "error");
      return;
    }

    if (dictionnaireCharge && !motsAutorises.has(motActuel)) {
      afficherMessage("Ce mot n'est pas dans le dictionnaire.", "error");
      return;
    }

    validationEnCours = true;
    afficherMessage("Vérification…");

    try {
      const reponse = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mot: motActuel })
      });

      const donnees = await reponse.json().catch(() => ({}));

      if (!reponse.ok) {
        throw new Error(donnees.error || "Impossible de vérifier le mot.");
      }

      if (!Array.isArray(donnees.resultat) || donnees.resultat.length !== LONGUEUR_MOT) {
        throw new Error("Réponse invalide du serveur.");
      }

      const mot = motActuel;
      essais.push(mot);
      attemptsDisplay.textContent = essais.length;
      afficherResultat(mot, donnees.resultat);

      if (donnees.gagne) {
        jeuTermine = true;
        afficherMessage(`🎉 Bravo ! Vous avez trouvé le mot : ${mot}.`, "success");
        return;
      }

      if (essais.length >= MAX_ESSAIS) {
        jeuTermine = true;
        afficherMessage("❌ Perdu ! Vous avez utilisé vos 6 essais.", "error");
        return;
      }

      motActuel = "";
      afficherMessage("");
    } catch (erreur) {
      console.error(erreur);
      afficherMessage(
        erreur?.message || "Impossible de contacter le serveur. Réessayez.",
        "error"
      );
    } finally {
      validationEnCours = false;
    }
  }

  function afficherResultat(mot, resultat) {
    const ligne = essais.length - 1;
    const cellules = board.children[ligne].children;

    for (let i = 0; i < LONGUEUR_MOT; i++) {
      const etat = resultat[i];
      if (!["correct", "misplaced", "absent"].includes(etat)) continue;

      cellules[i].classList.add(etat, "reveal");
      mettreAJourClavier(mot[i], etat);
    }
  }

  function mettreAJourClavier(lettre, nouvelEtat) {
    const niveau = { absent: 1, misplaced: 2, correct: 3 };
    const ancienEtat = niveau[etatClavier[lettre]] || 0;
    if (niveau[nouvelEtat] <= ancienEtat) return;

    etatClavier[lettre] = nouvelEtat;
    document.querySelectorAll(`.key[data-key="${lettre}"]`).forEach(touche => {
      touche.classList.remove("correct", "misplaced", "absent");
      touche.classList.add(nouvelEtat);
    });
  }

  function afficherMessage(texte, type = "") {
    message.textContent = texte;
    message.className = "message";
    if (type) message.classList.add(type);
  }

  function nouvellePartie() {
    essais = [];
    motActuel = "";
    jeuTermine = false;
    validationEnCours = false;
    Object.keys(etatClavier).forEach(lettre => delete etatClavier[lettre]);
    attemptsDisplay.textContent = "0";
    afficherMessage("");
    creerGrille();
    creerClavier();
  }

  restartBtn.addEventListener("click", nouvellePartie);
  nouvellePartie();
  chargerDictionnaire();
})();
