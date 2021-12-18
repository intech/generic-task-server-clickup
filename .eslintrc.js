module.exports = {
    root: true,
    env: {
        node: true,
        commonjs: true,
        es6: true,
        jquery: false,
        jest: true,
        jasmine: true
    },
    extends: "eslint:recommended",
    parserOptions: {
        sourceType: "module",
        ecmaVersion: 2021
    },
    rules: {
        indent: [2, 4, { SwitchCase: 1 }],
        quotes: ["error", "double"],
        semi: ["error", "always"],
        "no-var": ["error"],
        "no-console": ["error"],
        "no-unused-vars": ["error"],
        "no-mixed-spaces-and-tabs": ["error"],
        "object-curly-spacing": ["error", "always"]
    }
};
