const importPositions = {
    G: "Golman",
    LK: "Levo krilo",
    LB: "Levi bek",
    SB: "Srednji bek",
    DB: "Desni bek",
    DK: "Desno krilo",
    P: "Pivot"
};

let importedPlayers = [];

function normalizeName(value) {

    const cyrillic = "абвгдђежзијклљмнњопрстћуфхцчџш";
    const latin = [
        "a","b","v","g","d","đ","e","ž",
        "z","i","j","k","l","lj","m","n",
        "nj","o","p","r","s","t","ć","u",
        "f","h","c","č","dž","š"
    ];

    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[а-шђјљњћџ]/g, c => {

            const i = cyrillic.indexOf(c);

            return i >= 0 ? latin[i] : c;

        })
        .replace(/\s+/g, " ");
}

function playerKey(player) {

    return normalizeName(player.firstName) +
        "|" + normalizeName(player.lastName);
}

function showImportPlayers() {

    importedPlayers = [];

    main.innerHTML = `

        <button class="secondary-button"
            onclick="showSettings()">
            ← Podešavanja
        </button>

        <h2>Uvoz igrača iz Excel-a</h2>

        <p>Sezona ${escapeHTML(
            Database.load().activeSeason
        )}</p>

        <div class="form-panel">

            <h3>Izaberi Excel dokument</h3>

            <input type="file"
                accept=".xlsx,.xls"
                onchange="readPlayersExcel(this)">

            <p class="player-details">
                Podaci se neće upisati u bazu
                dok ne potvrdiš uvoz.
            </p>

        </div>

        <div id="importPreview"></div>
    `;
}

async function readPlayersExcel(input) {

    importedPlayers = [];

    const preview =
        document.getElementById("importPreview");

    preview.innerHTML = "";

    const file = input.files[0];

    if (!file) return;

    if (typeof XLSX === "undefined") {

        alert("Excel biblioteka nije učitana.");
        return;
    }

    try {

        const buffer = await file.arrayBuffer();

        const workbook = XLSX.read(buffer, {
            type: "array"
        });

        const sheet = workbook.Sheets["RK Obilić"];

        if (!sheet) {
            throw new Error(
                'Nije pronađen list "RK Obilić".'
            );
        }

        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            blankrows: true
        });

        const errors = [];
        const names = new Set();
        const numbers = new Set();

        const expected = [
            "redni broj",
            "prezime",
            "ime",
            "godina rođenja",
            "mesto u timu",
            "broj dresa",
            "status"
        ];

        const headers = rows[0] || [];

        const validHeaders = expected.every(
            (h, i) =>
                normalizeName(headers[i]) === h ||
                (i === 4 &&
                normalizeName(headers[i]) === "pozicija")
        );

        if (!validHeaders) {

            throw new Error(
                "Zaglavlja ne odgovaraju dogovorenoj tabeli."
            );
        }

        rows.slice(1).forEach((row, index) => {

            const excelRow = index + 2;

            if (row.every(v =>
                String(v).trim() === "")) {
                return;
            }

            const lastName = String(row[1]).trim();

            let firstName = String(row[2]).trim();

            // Ispravka poznate slovne greške

            if (
                normalizeName(lastName) === "pušica" &&
                normalizeName(firstName) === "starhinja"
            ) {
                firstName = "Страхиња";
            }

            const birthYear = Number(row[3]);

            const positionCode =
                String(row[4]).trim().toUpperCase();

            const number = Number(row[5]);

            const status =
                String(row[6]).trim().toUpperCase();

            const active = status === "DA";

            const player = {

                firstName,
                lastName,
                birthYear,
                number,

                position:
                    importPositions[positionCode] ||
                    "Nije određena",

                active,

                season: Database.load().activeSeason
            };

            const key = playerKey(player);

            const problems = [];

            if (!firstName || !lastName) {
                problems.push("Nedostaje ime ili prezime");
            }

            if (
                !Number.isInteger(number) ||
                number < 1 ||
                number > 99
            ) {
                problems.push("Neispravan broj dresa");
            }

            if (
                !Number.isInteger(birthYear) ||
                birthYear < 1900 ||
                birthYear > new Date().getFullYear()
            ) {
                problems.push("Neispravna godina rođenja");
            }

            if (
                positionCode &&
                !importPositions[positionCode]
            ) {
                problems.push("Nepoznata pozicija");
            }

            if (status !== "DA" && status !== "NE") {
                problems.push("Status mora biti DA ili NE");
            }

            if (names.has(key)) {
                problems.push("Dupliran igrač");
            }

            if (active && numbers.has(number)) {
                problems.push("Dupliran broj aktivnog igrača");
            }

            names.add(key);

            if (active) {
                numbers.add(number);
            }

            if (problems.length) {

                errors.push(
                    "Red " + excelRow + ": " +
                    problems.join(", ")
                );

                return;
            }

            importedPlayers.push(player);

        });

        if (errors.length) {

            preview.innerHTML = `

                <div class="form-panel">

                    <h3>Uvoz nije moguć</h3>

                    ${errors.map(e =>
                        `<p>${escapeHTML(e)}</p>`
                    ).join("")}

                </div>
            `;

            importedPlayers = [];

            return;
        }

        if (!importedPlayers.length) {
            throw new Error("Tabela ne sadrži igrače.");
        }

        renderImportPreview(file.name);

    } catch (error) {

        importedPlayers = [];

        preview.innerHTML = `
            <div class="form-panel">
                <h3>Greška pri učitavanju</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

function renderImportPreview(fileName) {

    const active = importedPlayers.filter(
        p => p.active
    ).length;

    document.getElementById("importPreview")
        .innerHTML = `

        <div class="form-panel">

            <h3>Pregled pre uvoza</h3>

            <p>${escapeHTML(fileName)}</p>

            <p>Ukupno:
                <strong>${importedPlayers.length}</strong>
            </p>

            <p>Aktivni: <strong>${active}</strong></p>

            <p>Neaktivni:
                <strong>
                    ${importedPlayers.length - active}
                </strong>
            </p>

        </div>

        ${importedPlayers
            .slice()
            .sort((a,b) => a.number - b.number)
            .map(p => `

                <div class="player-row
                    ${p.active ? "" : "player-inactive"}">

                    <div class="player-number">
                        ${p.number}
                    </div>

                    <div class="player-info">

                        <div class="player-name">
                            ${escapeHTML(p.lastName)}
                            ${escapeHTML(p.firstName)}
                        </div>

                        <div class="player-details">

                            ${escapeHTML(p.position)} |
                            ${p.birthYear} |
                            ${p.active
                                ? "Aktivan"
                                : "Neaktivan"}

                        </div>

                    </div>

                </div>

            `).join("")}

        <button class="action-button full-button"
            onclick="confirmPlayersImport()">

            POTVRDI UVOZ
            ${importedPlayers.length} IGRAČA

        </button>

        <button class="secondary-button full-button"
            onclick="showSettings()">
            Odustani
        </button>
    `;
}

function confirmPlayersImport() {

    if (!importedPlayers.length) return;

    if (!confirm("Potvrđuješ uvoz igrača u bazu?")) {
        return;
    }

    try {

        const data = Database.load();

        if (data.draftMatch) {

            alert("Prvo završi započetu utakmicu.");
            return;
        }

        let added = 0;
        let updated = 0;

        const season = data.activeSeason;

        importedPlayers.forEach(p => {

            const existing = data.players.filter(old =>
                old.season === season &&
                playerKey(old) === playerKey(p)
            );

            if (existing.length > 1) {

                throw new Error(
                    "Više postojećih igrača: " +
                    p.firstName + " " + p.lastName
                );
            }

            if (existing.length === 1) {

                const old = existing[0];

                if (
                    old.birthYear &&
                    old.birthYear !== p.birthYear
                ) {
                    throw new Error(
                        "Različita godina rođenja: " +
                        p.firstName + " " + p.lastName
                    );
                }

                Object.assign(old, p, { season });

                updated++;

            } else {

                data.players.push({

                    ...p,

                    season,

                    id: Date.now().toString() +
                        Math.random()
                            .toString(36).slice(2,10)
                });

                added++;
            }
        });

        const usedNumbers = new Set();

        data.players
            .filter(p => p.season === season && p.active)
            .forEach(p => {

                if (usedNumbers.has(p.number)) {

                    throw new Error(
                        "Sukob brojeva dresova: " +
                        p.number
                    );
                }

                usedNumbers.add(p.number);
            });

        Database.save(data);

        importedPlayers = [];

        alert(
            "Uvoz uspešan!\n" +
            "Dodato: " + added + "\n" +
            "Ažurirano: " + updated
        );

        showPlayers();

    } catch (error) {

        alert("Uvoz nije izvršen: " + error.message);
    }
}
