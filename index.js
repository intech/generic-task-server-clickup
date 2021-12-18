const fastify = require("fastify")({ logger: true });
const auth = require("basic-auth");
const got = require("got");

class ClickUp {
    constructor() {
        this.api = got.extend({
            prefixUrl: "https://api.clickup.com/api/v2/",
            responseType: "json",
            resolveBodyOnly: true
        });
        this.members = new Map();
    }

    async setToken(token) {
        this.api = this.api.extend({
            headers: {
                Authorization: token
            }
        });
        return this;
    }

    async getUser() {
        return this.api("user");
    }

    async getTeams() {
        return this.api("team");
    }

    async getSpaces(team) {
        return this.api(`team/${team}/space?archived=false`);
    }

    async getFolders(space) {
        return this.api(`space/${space}/folder?archived=false`);
    }

    async getFolderless(space) {
        return this.api(`space/${space}/list?archived=false`);
    }

    async getLists(folder) {
        return this.api(`folder/${folder}/list?archived=false`);
    }

    async getTasks(list, assign, page = 0) {
        const { tasks } = await this.api(`list/${list}/task?archived=false&subtasks=true&assignees[]=${assign}&page=${page}`);
        return tasks.map(({ id, name, text_content, date_created, date_updated, date_closed, url }) => ({
            id, name, text_content, date_created, date_updated, date_closed, url
        }));
    }

    async getViewTasks(view, assign, page = 0) {
        const { tasks } = await this.api(`view/${view}/task?archived=false&subtasks=true&assignees[]=${assign}&page=${page}`);
        return tasks.map(({ id, name, folder, list, date_created, date_updated, date_closed, url }) => ({
            id, name: `${folder.name} / ${list.name} / ${name}`, text_content: name, date_created, date_updated, date_closed, url
        }));
    }

    async getTeamTasks(page = 0, assign, project) {
        const params = new URLSearchParams({
            archived: false,
            subtasks: true,
            page,
        });
        if(assign) this.toQueryArray(params, "assignees[]", assign);
        if(project) this.toQueryArray(params,"project_ids[]", project);
        console.log(`team/${this.team}/task?${params}`);
        const { tasks } = await this.api(`team/${this.team}/task?${params}`);
        return tasks.map(({ id, name, text_content, date_created, date_updated, date_closed, url }) => ({
            id, name, text_content, date_created, date_updated, date_closed, url
        }));
    }

    toQueryArray(params, key, values) {
        return Array.isArray(values) ? values.every(value => params.append(key, value)) : params.set(key, values);
    }

    async init(token, team, space = "Space") {
        const api = await this.setToken(token);
        const { teams } = await api.getTeams();
        for(const { id, name, members } of teams) {
            if(name === team) {
                this.members = new Map(members.map(({ user }) => [user.email, user.id]));
                this.team = id;
                console.log(`> Team ${id}`);
                break;
            }
        }
        if(!this.team) throw new Error("Team name not found");

        const { spaces } = await api.getSpaces(this.team);
        for(const { id, name } of spaces) {
            if(name === space) {
                this.space = id;
                console.log(`> Space ${id}`);
                break;
            }
        }
        if(!this.space) throw new Error("Space not found");

        const { folders } = await api.getFolders(this.space);
        console.table(Object.fromEntries(folders.map(({id, name}) => [name, +id])));
        // for(const { id, name } of folders) {
            // if(name === folder) {
            //     this.folder = id;
            //     break;
            // }
        // }
        // if(!this.folder) throw new Error("Folder not found");

        // const { lists } = await api.getLists(this.folder);
        // for(const { id, name } of lists) {
        //     if(name === list) {
        //         this.list = id;
        //         break;
        //     }
        // }
        // if(!this.list) throw new Error("List not found");
    }
}

const api = new ClickUp();
api.init(Buffer.from("cGtfNDcxOTQyM19CQkpWRFRDVUo5S0k0WDIwSlBTT1JUM1lPQkxFUDgxTg==", "base64"), "Tokenplace", "Space")
.then(() => start())
.catch(console.error);

fastify.route({
    method: 'GET',
    url: '/tasks',
    onRequest: async (request) => {
        request.context.credentials = auth.parse(request.headers["authorization"]);
    },
    handler: async (request, reply) => {
        const page = Math.max(0, Math.floor(Number(request.query.max) / 20) - 1);
        const { name, pass } = request.context.credentials;
        await api.setToken(pass);
        const assign = api.members.get(name);
        console.log(`${name} (${assign})`, pass.replace(/(pk_\d+_)[a-z0-9]+([a-z0-9]{5})/i, "$1$2"), page, request.query.project);
        if(!assign) throw new Error("Access denied");
        return api.getTeamTasks(page, assign, request.query.project);
    }
});

// Run the server!
const start = async () => {
    try {
        await fastify.listen(process.env.PORT || 9876)
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
};
