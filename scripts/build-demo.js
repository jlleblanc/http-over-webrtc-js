const esbuild = require('esbuild');
const path = require('path');

async function build() {
    // Build Client
    await esbuild.build({
        entryPoints: [path.join(__dirname, '../examples/simple-demo/src/client.ts')],
        bundle: true,
        outfile: path.join(__dirname, '../examples/simple-demo/public/client.bundle.js'),
        sourcemap: true,
        target: ['es2020'],
        define: { 'process.env.NODE_ENV': '"development"' }
    });

    // Build SW
    // Note: SW needs to import from shared. 
    // We point to packages/client/src/sw.ts but we need to ensure it can resolve shared.
    // Esbuild handles tsconfig paths if configured, but strict bundling might need help.
    await esbuild.build({
        entryPoints: [path.join(__dirname, '../packages/client/src/sw.ts')],
        bundle: true,
        outfile: path.join(__dirname, '../examples/simple-demo/public/sw.js'),
        sourcemap: true,
        target: ['es2020'],
        // Alias shared package to src if not building from dist, or let node resolution find it.
        // Since we are in monorepo, node resolution should find packages/shared if package.json main points to dist
        // AND dist is built.
        // We verified dist is built.
    });

    // Build Host Browser
    await esbuild.build({
        entryPoints: [path.join(__dirname, '../examples/simple-demo/src/host-browser.ts')],
        bundle: true,
        outfile: path.join(__dirname, '../examples/simple-demo/public/host.bundle.js'),
        sourcemap: true,
        target: ['es2020'],
    });

    console.log("Build Complete: examples/simple-demo/public/");
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
