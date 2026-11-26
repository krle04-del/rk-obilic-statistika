const Database = {

    key: "rk_obilic_database",

    load() {
        const data = localStorage.getItem(this.key);

        if (data) {
            return JSON.parse(data);
        }

        return {
            version: 1,
            activeSeason: "2026/2027",
            seasons: ["2026/2027"],
            players: [],
            matches: []
        };
    },

    save(data) {
        localStorage.setItem(
            this.key,
            JSON.stringify(data)
        );
    },

    getPlayers() {
        return this.load().players;
    },

    addPlayer(player) {

        const data = this.load();

        player.id = Date.now().toString() +
            Math.random().toString(36).slice(2, 8);

        data.players.push(player);

        this.save(data);
    },

    updatePlayer(id, changes) {

        const data = this.load();

        const index = data.players.findIndex(
            player => player.id === id
        );

        if (index !== -1) {

            data.players[index] = {
                ...data.players[index],
                ...changes
            };

            this.save(data);
        }
    }
};

