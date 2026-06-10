import axios from 'axios';
import consola from 'consola';
import semver from 'semver';
import { readFile } from 'node:fs/promises';
const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf-8'));
export default class WapiMiddleware {
    version = packageJson.version;
    async handle({ view, response }, next) {
        const version = this.version;
        const v = await axios
            .get('https://raw.githubusercontent.com/ilsyaa/lazy-version/master/wapi.json')
            .catch((err) => {
            console.error(err);
        });
        if (v?.data?.latest && semver.gt(v.data.latest, version)) {
            consola.warn(`New version of WAPI is available. Current version: ${version}. New version: ${v.data.latest}`);
            const currentV = v.data.versions.find((vs) => vs.version === version);
            if (currentV && currentV.require_update) {
                const html = await view.render('pages/errors/require_update', {
                    currentVersion: version,
                    newVersion: v.data.latest,
                });
                return response.status(403).send(html);
            }
        }
        view.share({
            wapi_version_current: version,
            wapi_version_latest: v?.data?.latest,
            needs_update: (v?.data?.latest && semver.gt(v.data.latest, version)) || false,
        });
        return next();
    }
}
//# sourceMappingURL=wapi_middleware.js.map