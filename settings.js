function showSettings() {

    main.innerHTML = `

        <button class="secondary-button"
            onclick="showHome()">
            ← Početna
        </button>

        <h2>Podešavanja</h2>

        <div class="form-panel">

            <h3>📥 Uvoz podataka</h3>

            <button class="action-button full-button"
                onclick="showImportPlayers()">
                Uvoz igrača iz Excel-a
            </button>

        </div>

        <div class="form-panel">

            <h3>📊 Izvoz statistike</h3>

            <button class="action-button full-button"
                onclick="exportStatisticsExcel()">
                Izvoz statistike u Excel
            </button>

        </div>

        <div class="form-panel">

            <h3>💾 Rezervne kopije</h3>

            <button class="action-button full-button"
                onclick="exportBackup()">
                Preuzmi rezervnu kopiju
            </button>

            <button class="secondary-button full-button"
                onclick="document
                    .getElementById('backupInput').click()">

                Učitaj rezervnu kopiju

            </button>

            <input type="file"
                id="backupInput"
                accept=".json"
                style="display:none"
                onchange="restoreBackup(this)">

        </div>

        <div class="form-panel">

            <h3>⚠️ Brisanje podataka</h3>

            <p>Ovu opciju koristi samo
                za uklanjanje probnih podataka.</p>

            <button class="red-button full-button"
                style="color:white;border:0;
                       border-radius:8px;cursor:pointer"
                onclick="resetDatabase()">
                OBRIŠI SVE PODATKE
            </button>

        </div>
    `;
}

function exportBackup() {

    const data = Database.load();

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        {type: "application/json"}
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
        "RK_Obilic_Backup_" +
        new Date().toISOString().replace(/[:.]/g, "-") +
        ".json";

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function restoreBackup(input) {

    const file = input.files[0];

    if (!file) return;

    try {

        const data = JSON.parse(await file.text());

        if (
            data.version !== 1 ||
            !Array.isArray(data.players) ||
            !Array.isArray(data.matches) ||
            !Array.isArray(data.seasons) ||
            !data.seasons.includes(data.activeSeason)
        ) {

            throw new Error(
                "Neispravan format rezervne kopije."
            );
        }

        if (!confirm(
            "Učitavanje zamenjuje postojeću bazu. " +
            "Preuzmi rezervnu kopiju trenutnih podataka " +
            "pre nastavka. Želiš li da nastaviš?"
        )) {
            return;
        }

        Database.save(data);

        alert("Rezervna kopija je učitana.");

        location.reload();

    } catch (error) {

        alert("Greška: " + error.message);
    }

    input.value = "";
}

function resetDatabase() {

    const answer = prompt(

        "PAŽNJA! Brišu se svi igrači, " +
        "utakmice i statistika iz svih sezona.\n\n" +

        "Za potvrdu upiši: OBRISI"
    );

    if (answer !== "OBRISI") return;

    try {

        localStorage.removeItem(Database.key);

        location.reload();

    } catch (error) {

        alert("Brisanje nije uspelo: " + error.message);
    }
}

function exportStatisticsExcel() {

    if (typeof XLSX === "undefined") {

        alert("Excel biblioteka nije učitana.");
        return;
    }

    const data = Database.load();

    const season = data.activeSeason;

    const players = data.players.filter(
        p => p.season === season
    );

    const matches = data.matches.filter(
        m => m.season === season
    );

    const workbook = XLSX.utils.book_new();

    const playerRows = [[
        "Broj dresa",
        "Prezime",
        "Ime",
        "Godina rođenja",
        "Pozicija",
        "Status"
    ]];

    const totals = new Map();

    players.forEach(p => {

        playerRows.push([

            p.number,
            p.lastName,
            p.firstName,
            p.birthYear || "",
            p.position,
            p.active ? "DA" : "NE"
        ]);

        totals.set(p.id, {

            name: p.lastName + " " + p.firstName,
            appearances: 0,
            goals: 0,
            penalties: 0,
            exclusions: 0,
            redCards: 0,
            mvp: 0
        });
    });

    const matchRows = [[
        "Kolo",
        "Datum",
        "Protivnik",
        "Domaćinstvo",
        "Takmičenje",
        "Golovi Obilić",
        "Golovi protivnik"
    ]];

    const detailRows = [[
        "Kolo",
        "Datum",
        "Protivnik",
        "Takmičenje",
        "Broj dresa",
        "Igrač",
        "Golovi",
        "7m",
        "2 min",
        "CK",
        "MVP"
    ]];

    matches.forEach(m => {

        matchRows.push([

            m.round,
            m.date,
            m.opponent,
            m.venue === "home" ? "Domaćin" : "Gost",
            m.competition,
            getMatchGoals(m),
            m.opponentGoals
        ]);

        m.players.forEach(p => {

            const goals = p.goals + p.penalties;

            detailRows.push([

                m.round,
                m.date,
                m.opponent,
                m.competition,
                p.number,
                p.lastName + " " + p.firstName,
                goals,
                p.penalties,
                p.exclusions,
                p.redCards,
                m.mvp === p.id ? 1 : 0
            ]);

            if (!totals.has(p.id)) {

                totals.set(p.id, {
                    name: p.lastName + " " + p.firstName,
                    appearances: 0,
                    goals: 0,
                    penalties: 0,
                    exclusions: 0,
                    redCards: 0,
                    mvp: 0
                });
            }

            const t = totals.get(p.id);

            t.appearances++;
            t.goals += goals;
            t.penalties += p.penalties;
            t.exclusions += p.exclusions;
            t.redCards += p.redCards;

            if (m.mvp === p.id) t.mvp++;
        });
    });

    const summaryRows = [[
        "Igrač",
        "Nastupi",
        "Golovi",
        "7m",
        "2 min",
        "CK",
        "MVP",
        "Prosek golova"
    ]];

    [...totals.values()]
        .sort((a,b) => b.goals - a.goals)
        .forEach(p => {

            summaryRows.push([

                p.name,
                p.appearances,
                p.goals,
                p.penalties,
                p.exclusions,
                p.redCards,
                p.mvp,
                p.appearances
                    ? Number(
                        (p.goals / p.appearances).toFixed(2)
                    )
                    : 0
            ]);
        });

    const sheets = [

        ["Igraci", playerRows,
            [12,22,20,16,20,12]],

        ["Utakmice", matchRows,
            [10,15,25,16,25,18,18]],

        ["Statistika", detailRows,
            [10,15,25,25,12,30,10,8,10,8,8]],

        ["Zbirna statistika", summaryRows,
            [30,12,12,8,10,8,8,16]]
    ];

    sheets.forEach(([name, rows, widths]) => {

        const sheet = XLSX.utils.aoa_to_sheet(rows);

        sheet["!cols"] = widths.map(w => ({
            wch: w
        }));

        XLSX.utils.book_append_sheet(
            workbook, sheet, name
        );
    });

    XLSX.writeFile(

        workbook,

        "RK_Obilic_Statistika_" +
        season.replace("/", "-") +
        ".xlsx"
    );
}

const settingsPreviousSection = openSection;

openSection = function(section) {

    if (section === "Podešavanja") {

        showSettings();

    } else {

        settingsPreviousSection(section);
    }
};
