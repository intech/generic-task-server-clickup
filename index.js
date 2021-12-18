const fastify = require("fastify")({ logger: true });
const auth = require("basic-auth");
const got = require("got");
require("dotenv").config();

/**
 * ClickUp API
 */
class ClickUp {
    /**
     * Constructor
     */
    constructor() {
        this.api = got.extend({
            prefixUrl: "https://api.clickup.com/api/v2/",
            responseType: "json",
            resolveBodyOnly: true
        });
        this.members = new Map();
    }

    /**
     * setToken
     * @param token
     * @return {Promise<ClickUp>}
     */
    async setToken(token) {
        this.api = this.api.extend({
            headers: {
                Authorization: token
            }
        });
        return this;
    }

    /**
     * getUser
     * @return {CancelableRequest<Response<string>>}
     */
    async getUser() {
        return this.api("user");
    }

    /**
     * getTeams
     * @return {CancelableRequest<Response<string>>}
     */
    async getTeams() {
        return this.api("team");
    }

    /**
     * getSpaces
     * @param {number} team
     * @return {CancelableRequest<Response<string>>}
     */
    async getSpaces(team) {
        return this.api(`team/${team}/space?archived=false`);
    }

    /**
     * getFolders
     * @param {number} space
     * @return {CancelableRequest<Response<string>>}
     */
    async getFolders(space) {
        return this.api(`space/${space}/folder?archived=false`);
    }

    /**
     * getFolderess
     * @param {number} space
     * @return {CancelableRequest<Response<string>>}
     */
    async getFolderless(space) {
        return this.api(`space/${space}/list?archived=false`);
    }

    /**
     * getLists
     * @param {number} folder
     * @return {CancelableRequest<Response<string>>}
     */
    async getLists(folder) {
        return this.api(`folder/${folder}/list?archived=false`);
    }

    /**
     * getTasks
     * @param {number} list
     * @param {number} assign
     * @param {number} page
     * @return {Promise<*>}
     */
    async getTasks(list, assign, page = 0) {
        const { tasks } = await this.api(
            `list/${list}/task?archived=false&subtasks=true&assignees[]=${assign}&page=${page}`
        );
        return tasks.map(
            ({ id, name, text_content, date_created, date_updated, date_closed, url }) => ({
                id,
                name,
                text_content,
                date_created,
                date_updated,
                date_closed,
                url
            })
        );
    }

    /**
     * getViewTasks
     * @param {number} view
     * @param {number} assign
     * @param {number} page
     * @return {Promise<*>}
     */
    async getViewTasks(view, assign, page = 0) {
        const { tasks } = await this.api(
            `view/${view}/task?archived=false&subtasks=true&assignees[]=${assign}&page=${page}`
        );
        return tasks.map(
            ({ id, name, folder, list, date_created, date_updated, date_closed, url }) => ({
                id,
                name: `${folder.name} / ${list.name} / ${name}`,
                text_content: name,
                date_created,
                date_updated,
                date_closed,
                url
            })
        );
    }

    /**
     * getTeamTasks
     * @param {number} page
     * @param {number} assign
     * @param {number} project
     * @return {Promise<*>}
     */
    async getTeamTasks(page = 0, assign, project) {
        const params = new URLSearchParams({
            archived: false,
            subtasks: true,
            page
        });
        if (assign) this.toQueryArray(params, "assignees[]", assign);
        if (project) this.toQueryArray(params, "project_ids[]", project);
        const { tasks } = await this.api(`team/${this.team}/task?${params}`);
        return tasks.map(
            ({ id, name, text_content, date_created, date_updated, date_closed, url }) => ({
                id,
                name,
                text_content,
                date_created,
                date_updated,
                date_closed,
                url
            })
        );
    }

    /**
     * toQueryArray
     * @param {URLSearchParams} params
     * @param {string} key
     * @param {number|string|array} values
     * @return {*}
     */
    toQueryArray(params, key, values) {
        return Array.isArray(values)
            ? values.every(value => params.append(key, value))
            : params.set(key, values);
    }

    /**
     * init
     * @param {string} token
     * @param {string} team
     * @param {string} space
     * @return {Promise<void>}
     */
    async init(token, team, space = "Space") {
        const api = await this.setToken(token);
        const { teams } = await api.getTeams();
        for (const { id, name, members } of teams) {
            if (name === team) {
                this.members = new Map(members.map(({ user }) => [user.email, user.id]));
                this.team = id;
                console.log(`> Team ${id}`);
                break;
            }
        }
        if (!this.team) throw new Error("Team name not found");

        const { spaces } = await api.getSpaces(this.team);
        for (const { id, name } of spaces) {
            if (name === space) {
                this.space = id;
                console.log(`> Space ${id}`);
                break;
            }
        }
        if (!this.space) throw new Error("Space not found");

        const { folders } = await api.getFolders(this.space);
        console.table(Object.fromEntries(folders.map(({ id, name }) => [name, +id])));
    }
}

const api = new ClickUp();
api.init(process.env.TOKEN, process.env.TEAM, process.env.SPACE)
    .then(() => start())
    .catch(console.error);

fastify.route({
    method: "GET",
    url: "/tasks",
    onRequest: async request => {
        request.context.credentials = auth.parse(request.headers["authorization"]);
    },
    handler: async request => {
        const page = Math.max(0, Math.floor(Number(request.query.max) / 20) - 1);
        const { name, pass } = request.context.credentials;
        await api.setToken(pass);
        const assign = api.members.get(name);
        console.log(
            `${name} (${assign})`,
            pass.replace(/(pk_\d+_)[a-z0-9]+([a-z0-9]{5})/i, "$1$2"),
            page,
            request.query.project
        );
        if (!assign) throw new Error("Access denied");
        return api.getTeamTasks(page, assign, request.query.project);
    }
});

// Run the server!
const start = async () => {
    try {
        await fastify.listen(process.env.PORT || 9876);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
