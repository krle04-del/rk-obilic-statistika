let pendingMatchImport = null;

function showImportMatches() {

    pendingMatchImport = null;

    main.innerHTML = `

        <button class="secondary-button"
            onclick="showSettings()">
            ← Podešavanja
        </button>

        <h2>Uvoz utakmica i statistike</h2>

        <p>Sezona ${escapeHTML(
            Database.load().activeSeason
        )}</p>

        <div class="form-panel">

            <h3>Izaberi Excel dokument</h3>

            <input type="file"
                accept=".xlsx,.xls"
                onchange="readMatchesExcel(this)">

            <p>
                Podaci se upisuju tek nakon potvrde.
            </p>

        </div>

        <div id="matchImportPreview"></div>
    `;
}

async function readMatchesExcel(input) {

    pendingMatchImport = null;

    const preview = document.getElementById(
        "matchImportPreview"
    );

    preview.innerHTML = "";

    const file = input.files[0];

    if (!file) return;

    try {

        if (typeof XLSX === "undefined") {
            throw new Error(
                "Excel biblioteka nije učitana."
            );
        }

        const workbook = XLSX.read(
            await file.arrayBuffer(),
            {type: "array"}
        );

        const matchSheet =
            workbook.Sheets["Utakmice"];

        const statSheet =
            workbook.Sheets["Statistika"];

        if (!matchSheet || !statSheet) {
            throw new Error(
                "Potrebni su listovi Utakmice i Statistika."
            );
        }

        const data = Database.load();

        const season = data.activeSeason;

        if (data.draftMatch) {
            throw new Error(
                "Prvo završi započetu utakmicu."
            );
        }

        const rows = XLSX.utils.sheet_to_json(
            matchSheet, {defval: ""}
        );

        const stats = XLSX.utils.sheet_to_json(
            statSheet, {defval: ""}
        );

        const errors = [];
        const matches = new Map();

        const normalize = value =>
            normalizeName(String(value ?? ""));

        const matchKey = (round, competition) =>
            normalize(competition) + "|" +
            String(round).trim();

        function readNumber(value, label) {

            if (String(value).trim() === "") {
                throw new Error(
                    "Nedostaje podatak: " + label
                );
            }

            const number = Number(value);

            if (!Number.isInteger(number) ||
                number < 0) {

                throw new Error(
                    "Neispravan podatak: " + label
                );
            }

            return number;
        }

        function readDate(value) {

            if (typeof value === "number") {

                const d = XLSX.SSF.parse_date_code(value);

                if (!d) return null;

                value = [
                    d.y,
                    String(d.m).padStart(2, "0"),
                    String(d.d).padStart(2, "0")
                ].join("-");
            }

            let date = String(value).trim();

            const parts = date.match(
                /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/
            );

            if (parts) {

                date = [
                    parts[3],
                    parts[2].padStart(2, "0"),
                    parts[1].padStart(2, "0")
                ].join("-");
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return null;
            }

            const parsed = new Date(
                date + "T00:00:00Z"
            );

            if (Number.isNaN(parsed.getTime()) ||
                parsed.toISOString().slice(0,10) !== date) {

                return null;
            }

            return date;
        }

        rows.forEach((row, index) => {

            try {

                const round = String(
                    row["Kolo"] ?? ""
                ).trim();

                const opponent = String(
                    row["Protivnik"] ?? ""
                ).trim();

                const competition = String(
                    row["Takmičenje"] ?? ""
                ).trim();

                const date = readDate(row["Datum"]);

                const venueText = normalize(
                    row["Domaćin/Gost"]
                );

                const venue =
                    venueText === "domaćin"
                        ? "home"
                        : venueText === "gost"
                            ? "away"
                            : null;

                if (!round || !opponent ||
                    !competition || !date || !venue) {

                    throw new Error(
                        "Nedostaju podaci o utakmici."
                    );
                }

                const ownGoals = readNumber(
                    row["Golovi Obilić"],
                    "Golovi Obilić"
                );

                const opponentGoals = readNumber(
                    row["Golovi protivnik"],
                    "Golovi protivnik"
                );

                const key = matchKey(
                    round, competition
                );

                if (matches.has(key)) {

                    throw new Error(
                        "Duplirana utakmica."
                    );
                }

                const exists = data.matches.some(m =>

                    m.season === season &&

                    matchKey(
                        m.round,
                        m.competition
                    ) === key
                );

                if (exists) {

                    throw new Error(
                        "Utakmica već postoji u bazi."
                    );
                }

                const halfOwn =
                    row["Poluvreme Obilić"];

                const halfOpp =
                    row["Poluvreme protivnik"];

                if (String(halfOwn ?? "").trim() !== "" ||
                    String(halfOpp ?? "").trim() !== "") {

                    const h1 = readNumber(
                        halfOwn, "Poluvreme Obilić"
                    );

                    const h2 = readNumber(
                        halfOpp, "Poluvreme protivnik"
                    );

                    if (h1 > ownGoals ||
                        h2 > opponentGoals) {

                        throw new Error(
                            "Neispravan rezultat poluvremena."
                        );
                    }
                }

                matches.set(key, {

                    id: "import-" +
                        Date.now() + "-" + index,

                    season,
                    round,
                    date,
                    opponent,
                    competition,
                    venue,

                    expectedGoals: ownGoals,

                    opponentGoals,

                    halfTime: {
                        own: halfOwn === "" ||
                            halfOwn == null
                            ? null : Number(halfOwn),

                        opponent: halfOpp === "" ||
                            halfOpp == null
                            ? null : Number(halfOpp)
                    },

                    mvp: null,
                    history: [],
                    players: [],
                    finished: true,
                    source: "Excel import"
                });

            } catch (error) {

                errors.push(
                    "Utakmice, red " + (index + 2) +
                    ": " + error.message
                );
            }
        });

        stats.forEach((row, index) => {

            try {

                const match = matches.get(
                    matchKey(
                        row["Kolo"],
                        row["Takmičenje"]
                    )
                );

                if (!match) {

                    throw new Error(
                        "Utakmica nije pronađena."
                    );
                }

                const found = data.players.filter(p =>

                    p.season === season &&

                    normalize(p.firstName) ===
                    normalize(row["Ime"]) &&

                    normalize(p.lastName) ===
                    normalize(row["Prezime"])
                );

                if (found.length !== 1) {

                    throw new Error(
                        "Igrač nije jednoznačno pronađen: " +
                        row["Ime"] + " " + row["Prezime"]
                    );
                }

                const player = found[0];

                if (match.players.some(
                    p => p.id === player.id
                )) {

                    throw new Error(
                        "Igrač je već unet za ovo kolo."
                    );
                }

                const total = readNumber(
                    row["Golovi ukupno"], "Golovi"
                );

                const penalties = readNumber(
                    row["Golovi iz sedmerca"],
                    "Sedmerci"
                );

                if (penalties > total) {

                    throw new Error(
                        "Sedmerci premašuju ukupan broj golova."
                    );
                }

                const exclusions = readNumber(
                    row["Isključenja 2 min"],
                    "Isključenja"
                );

                const redCards = readNumber(
                    row["Crveni kartoni"],
                    "Crveni kartoni"
                );

                const mvp = readNumber(
                    row["MVP"], "MVP"
                );

                if (mvp > 1) {
                    throw new Error(
                        "MVP mora biti 0 ili 1."
                    );
                }

                if (mvp === 1 && match.mvp) {

                    throw new Error(
                        "Više MVP igrača na utakmici."
                    );
                }

                if (mvp === 1) {
                    match.mvp = player.id;
                }

                match.players.push({

                    id: player.id,

                    number: player.number,

                    firstName: player.firstName,

                    lastName: player.lastName,

                    goals: total - penalties,

                    penalties,

                    exclusions,

                    redCards
                });

            } catch (error) {

                errors.push(
                    "Statistika, red " + (index + 2) +
                    ": " + error.message
                );
            }
        });

        for (const match of matches.values()) {

            if (!match.players.length) {

                errors.push(
                    match.round +
                    ". kolo: nema sastava."
                );
            }

            const goals = match.players.reduce(
                (sum,p) =>
                    sum + p.goals + p.penalties,
                0
            );

            if (goals !== match.expectedGoals) {

                errors.push(

                    match.round + ". kolo: " +

                    "Zbir golova igrača je " +
                    goals +

                    ", rezultat je " +
                    match.expectedGoals + "."
                );
            }
        }

        if (!matches.size) {
            errors.push(
                "Nema utakmica za uvoz."
            );
        }

        if (errors.length) {

            preview.innerHTML = `

                <div class="form-panel">

                    <h3>Uvoz nije moguć</h3>

                    ${errors.map(e =>
                        `<p>${escapeHTML(e)}</p>`
                    ).join("")}

                </div>
            `;

            return;
        }

        pendingMatchImport = {

            season,

            matches: [...matches.values()],

            originalDatabase: JSON.stringify(data)
        };

        renderMatchImportPreview();

    } catch (error) {

        preview.innerHTML = `
            <div class="form-panel">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderMatchImportPreview() {

    const matches = pendingMatchImport.matches;

    const total = matches.reduce(
        (sum,m) => sum + m.expectedGoals,
        0
    );

    document.getElementById(
        "matchImportPreview"
    ).innerHTML = `

        <div class="form-panel">

            <h3>Pregled pre uvoza</h3>

            <p>Utakmica: ${matches.length}</p>

            <p>Golova Obilića: ${total}</p>

        </div>

        ${matches.map(m => `

            <div class="player-row">

                <div class="player-info">

                    <div class="player-details">
                        ${escapeHTML(m.round)}. kolo |
                        ${escapeHTML(m.date)}
                    </div>

                    <div class="player-name">
                        ${escapeHTML(m.opponent)}
                    </div>

                    <div class="player-details">
                        Igrača: ${m.players.length}
                    </div>

                </div>

                <h2>
                    ${m.expectedGoals}:${m.opponentGoals}
                </h2>

            </div>

        `).join("")}

        <button class="action-button full-button"
            onclick="confirmMatchImport()">
            POTVRDI UVOZ
        </button>

        <button class="secondary-button full-button"
            onclick="showSettings()">
            Odustani
        </button>
    `;
}

function confirmMatchImport() {

    if (!pendingMatchImport) return;

    const data = Database.load();

    if (JSON.stringify(data) !==
        pendingMatchImport.originalDatabase) {

        alert(
            "Baza je promenjena. Ponovi pregled uvoza."
        );

        showImportMatches();

        return;
    }

    if (!confirm(
        "Da li potvrđuješ uvoz utakmica?"
    )) return;

    try {

        const matches = pendingMatchImport.matches;

        data.matches.push(...matches);

        Database.save(data);

        pendingMatchImport = null;

        alert(
            "Uspešno uvezeno utakmica: " +
            matches.length
        );

        showMatches();

    } catch (error) {

        alert(
            "Uvoz nije izvršen: " + error.message
        );
    }
}

// Dodavanje dugmeta u podešavanja

const matchImportPreviousSettings = showSettings;

showSettings = function() {

    matchImportPreviousSettings();

    const panel = main.querySelector(".form-panel");

    if (!panel) return;

    const button = document.createElement("button");

    button.className = "action-button full-button";

    button.textContent =
        "Uvoz utakmica i statistike iz Excel-a";

    button.onclick = showImportMatches;

    panel.appendChild(button);
};
