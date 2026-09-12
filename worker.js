export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Méthode non autorisée" }, 405, cors);
    }

    if (!env.MOT_SECRET) {
      return json({ error: "Mot secret non configuré" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Requête invalide" }, 400, cors);
    }

    const mot = normaliserMot(body?.mot || "");
    const solution = normaliserMot(env.MOT_SECRET);

    if (!/^[A-Z]{10}$/.test(mot)) {
      return json({ error: "Le mot doit contenir exactement 10 lettres" }, 400, cors);
    }

    if (!/^[A-Z]{10}$/.test(solution)) {
      return json({ error: "Configuration du mot secret invalide" }, 500, cors);
    }

    const resultat = analyserMot(mot, solution);

    return json(
      {
        resultat,
        gagne: mot === solution
      },
      200,
      cors
    );
  }
};

function normaliserMot(mot) {
  return String(mot)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function analyserMot(mot, solution) {
  const resultat = new Array(solution.length).fill("absent");
  const utilisees = new Array(solution.length).fill(false);

  for (let i = 0; i < solution.length; i++) {
    if (mot[i] === solution[i]) {
      resultat[i] = "correct";
      utilisees[i] = true;
    }
  }

  for (let i = 0; i < solution.length; i++) {
    if (resultat[i] === "correct") continue;

    for (let j = 0; j < solution.length; j++) {
      if (!utilisees[j] && mot[i] === solution[j]) {
        resultat[i] = "misplaced";
        utilisees[j] = true;
        break;
      }
    }
  }

  return resultat;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
