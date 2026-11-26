const main = document.querySelector("main");
const homeHTML = main.innerHTML;

const positions = [
    "Golman",
    "Levo krilo",
    "Levi bek",
    "Srednji bek",
    "Desni bek",
    "Desno krilo",
    "Pivot",
    "Nije određena"
];

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]
    );
}

function seasonPlayers() {

    const data = Database.load();

    return data.players.filter(
        p => p.season === data.activeSeason
    );
}

function getPlayerBirthYear(player) {

    if (player.birthYear) {
        return player.birthYear;
    }

    if (player.birthDate) {

        const year = Number(
            String(player.birthDate).slice(0, 4)
        );

        if (year >= 1900 &&
            year <= new Date().getFullYear()) {
            return year;
        }
    }

    return "";
}

function showHome() {

    main.innerHTML = homeHTML;

    const cards = main.querySelectorAll(".card strong");

    const players = seasonPlayers().filter(
        p => p.active
    );

    cards[0].textContent = players.length;
}

function openSection(section) {

    if (section === "Igrači") {
        showPlayers();
    } else {
        alert(section + " - modul u pripremi.");
    }
}

function showPlayers() {

    const players = seasonPlayers();

    const active = players.filter(
        p => p.active
    ).length;

    main.innerHTML = `

        <div class="module-toolbar">

            <button class="secondary-button"
                onclick="showHome()">
                ← Početna
            </button>

            <button class="action-button"
                onclick="showPlayerForm()">
                + Dodaj igrača
            </button>

        </div>

        <h2>Licencirani igrači</h2>

        <p>
            Sezona ${escapeHTML(
                Database.load().activeSeason
            )}
        </p>

        <div class="dashboard"
            style="margin-bottom:20px">

            <div class="card">
                <strong>${players.length}</strong>
                <span>UKUPNO IGRAČA</span>
            </div>

            <div class="card">
                <strong>${active}</strong>
                <span>AKTIVNI</span>
            </div>

            <div class="card">
                <strong>${players.length - active}</strong>
                <span>NEAKTIVNI</span>
            </div>

        </div>

        <div id="playerForm"></div>

        <input type="search"
            id="playerSearch"
            class="search-input"
            placeholder="Pretraži igrače..."
            oninput="renderPlayers()">

        <div class="form-field"
            style="margin-bottom:16px">

            <select id="playerStatusFilter"
                onchange="renderPlayers()">

                <option value="all">
                    Svi igrači
                </option>

                <option value="active">
                    Samo aktivni igrači
                </option>

                <option value="inactive">
                    Samo neaktivni igrači
                </option>

            </select>

        </div>

        <div id="playerList"></div>
    `;

    renderPlayers();
}

function renderPlayers() {

    const list = document.getElementById("playerList");

    const search = document
        .getElementById("playerSearch")
        .value.trim();

    const status = document
        .getElementById("playerStatusFilter")
        .value;

    const normalize = value =>
        typeof normalizeName === "function"
            ? normalizeName(value)
            : String(value ?? "").toLowerCase();

    const players = seasonPlayers()

        .filter(p => {

            const name = normalize(
                p.firstName + " " +
                p.lastName + " " +
                p.firstName + " " +
                p.number
            );

            return name.includes(
                normalize(search)
            );
        })

        .filter(p => {

            if (status === "active") {
                return p.active;
            }

            if (status === "inactive") {
                return !p.active;
            }

            return true;
        })

        .sort((a, b) => a.number - b.number);

    if (players.length === 0) {

        list.innerHTML = `
            <div class="empty-state">
                Nema pronađenih igrača.
            </div>
        `;

        return;
    }

    list.innerHTML = players.map(p => `

        <div class="player-row
            ${p.active ? "" : "player-inactive"}">

            <div class="player-number">
                ${escapeHTML(p.number)}
            </div>

            <div class="player-info">

                <div class="player-name">
                    ${escapeHTML(p.firstName)}
                    ${escapeHTML(p.lastName)}
                </div>

                <div class="player-details">

                    ${escapeHTML(
                        p.position || "Nije određena"
                    )}

                    ${getPlayerBirthYear(p)
                        ? " · " + escapeHTML(
                            getPlayerBirthYear(p)
                        )
                        : ""}

                    ·

                    ${p.active
                        ? "Aktivan"
                        : "Neaktivan"}

                </div>

            </div>

            <button class="secondary-button"
                data-id="${escapeHTML(p.id)}"
                onclick="showPlayerForm(this.dataset.id)">
                Izmeni
            </button>

        </div>

    `).join("");
}

function showPlayerForm(id = null) {

    const player = id
        ? seasonPlayers().find(p => p.id === id)
        : null;

    if (id && !player) {
        alert("Igrač nije pronađen.");
        return;
    }

    const p = player || {

        firstName: "",
        lastName: "",
        number: "",
        position: "Nije određena",
        birthYear: "",
        active: true
    };

    const currentPosition =
        p.position || "Nije određena";

    const availablePositions = [
        ...new Set([
            ...positions,
            currentPosition
        ])
    ];

    document.getElementById("playerForm").innerHTML = `

        <div class="form-panel">

            <h3>
                ${id ? "Izmena igrača" : "Novi igrač"}
            </h3>

            <form id="editPlayerForm">

                <div class="form-grid">

                    <div class="form-field">

                        <label>Ime *</label>

                        <input name="firstName"
                            value="${escapeHTML(p.firstName)}"
                            required>

                    </div>

                    <div class="form-field">

                        <label>Prezime *</label>

                        <input name="lastName"
                            value="${escapeHTML(p.lastName)}"
                            required>

                    </div>

                    <div class="form-field">

                        <label>Broj dresa *</label>

                        <input type="number"
                            name="number"
                            min="1"
                            max="99"
                            step="1"
                            value="${escapeHTML(p.number)}"
                            required>

                    </div>

                    <div class="form-field">

                        <label>Pozicija</label>

                        <select name="position">

                            ${availablePositions.map(pos => `

                                <option
                                    value="${escapeHTML(pos)}"

                                    ${currentPosition === pos
                                        ? "selected" : ""}>

                                    ${escapeHTML(pos)}

                                </option>

                            `).join("")}

                        </select>

                    </div>

                    <div class="form-field">

                        <label>Godina rođenja</label>

                        <input type="number"
                            name="birthYear"
                            min="1900"
                            max="${new Date().getFullYear()}"
                            step="1"
                            placeholder="npr. 2004"
                            value="${escapeHTML(
                                getPlayerBirthYear(p)
                            )}">

                    </div>

                    <div class="form-field">

                        <label>Status igrača</label>

                        <select name="active">

                            <option value="true"
                                ${p.active ? "selected" : ""}>
                                Aktivan
                            </option>

                            <option value="false"
                                ${!p.active ? "selected" : ""}>
                                Neaktivan
                            </option>

                        </select>

                    </div>

                </div>

                <div class="form-actions">

                    <button type="submit"
                        class="action-button">
                        Sačuvaj igrača
                    </button>

                    <button type="button"
                        class="secondary-button"
                        onclick="closePlayerForm()">
                        Odustani
                    </button>

                </div>

            </form>

        </div>
    `;

    document.getElementById("editPlayerForm")
        .addEventListener("submit", event => {

            event.preventDefault();

            savePlayer(event.target, id);
        });

    document.getElementById("playerForm")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}

function closePlayerForm() {

    document.getElementById("playerForm")
        .innerHTML = "";
}

function savePlayer(form, id) {

    const values = new FormData(form);

    const year = values.get("birthYear");

    const player = {

        firstName: values.get("firstName").trim(),

        lastName: values.get("lastName").trim(),

        number: Number(values.get("number")),

        position: values.get("position"),

        birthYear: year ? Number(year) : null,

        birthDate: "",

        license: "",

        active: values.get("active") === "true",

        season: Database.load().activeSeason
    };

    if (!player.firstName || !player.lastName) {

        alert("Unesi ime i prezime igrača.");

        return;
    }

    if (
        !Number.isInteger(player.number) ||
        player.number < 1 ||
        player.number > 99
    ) {

        alert("Broj dresa mora biti od 1 do 99.");

        return;
    }

    if (
        player.birthYear !== null &&
        (
            !Number.isInteger(player.birthYear) ||
            player.birthYear < 1900 ||
            player.birthYear > new Date().getFullYear()
        )
    ) {

        alert("Godina rođenja nije ispravna.");

        return;
    }

    const duplicate = seasonPlayers().some(p =>

        p.id !== id &&
        p.active &&
        player.active &&
        Number(p.number) === player.number
    );

    if (duplicate) {

        alert(
            "Ovaj broj dresa već koristi " +
            "drugi aktivni igrač."
        );

        return;
    }

    const normalize = value =>
        typeof normalizeName === "function"
            ? normalizeName(value)
            : String(value ?? "").trim().toLowerCase();

    const samePlayer = seasonPlayers().some(p =>

        p.id !== id &&

        normalize(p.firstName) ===
            normalize(player.firstName) &&

        normalize(p.lastName) ===
            normalize(player.lastName)
    );

    if (samePlayer) {

        alert(
            "Igrač sa ovim imenom i prezimenom " +
            "već postoji u bazi."
        );

        return;
    }

    try {

        if (id) {

            Database.updatePlayer(id, player);

        } else {

            Database.addPlayer(player);
        }

    } catch (error) {

        alert(
            "Podaci nisu sačuvani: " +
            error.message
        );

        return;
    }

    showPlayers();
}

showHome();
