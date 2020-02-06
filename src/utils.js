import request from 'request-promise';
import { flatten } from 'lodash';

export const CBT_API_PATHS = {
    browserList: {
        url:
            'https://crossbrowsertesting.com/api/v3/selenium/browsers?format=json',
    },
    tunnelInfo: {
        url: 'https://crossbrowsertesting.com/api/v3/tunnels?active=true',
    },
    deleteTunnel: (id) => ({
        url: `https://crossbrowsertesting.com/api/v3/tunnels/${id}`,
        method: 'DELETE',
    }),
    seleniumTestHistory: {
        url: 'https://crossbrowsertesting.com/api/v3/selenium?active=true',
    },
    deleteBrowser: (id) => ({
        url: `https://crossbrowsertesting.com/api/v3/selenium/${id}`,
        method: 'DELETE',
    }),
};
//Call API to set the score
export async function setScore({ sessionId, score }) {
    const username = process.env['CBT_USERNAME'];
    const authkey = process.env['CBT_AUTHKEY'];

    if (sessionId) {
        try {
            await request({
                method: 'PUT',
                uri:
                    'https://crossbrowsertesting.com/api/v3/selenium/' +
                    sessionId,
                body: { action: 'set_score', score: score },
                json: true,
            }).auth(username, authkey);
            return 'Pass';
        } catch (e) {
            return 'Fail';
        }
    }
}

export function getCapabilities({ id, browserName }) {
    let capabilities;
    let colon = browserName.indexOf(':');

    if (colon > -1) {
        var platform = browserName.substr(colon + 1);

        browserName = browserName.substr(0, colon);
    }
    var at = browserName.indexOf('@');

    if (at > -1) {
        var version = browserName.substr(at + 1);

        browserName = browserName.substr(0, at);
    }

    if (browserName !== 'Chrome Mobile' && browserName !== 'Mobile Safari') {
        capabilities = {
            browserName: browserName,
            version: version,
            platform: platform,
        };
    } else {
        capabilities = {
            browserName: browserName,
            platformVersion: version,
            deviceName: platform,
        };
    }

    // CrossBrowserTesting-Specific Capabilities
    capabilities.name = `TestCafe test run ${id}`;
    if (process.env.CBT_BUILD) capabilities.build = process.env.CBT_BUILD;
    if (process.env.CBT_RECORD_VIDEO)
        capabilities.record_video = process.env.CBT_RECORD_VIDEO.match(/true/i);
    if (process.env.CBT_RECORD_NETWORK)
        capabilities.record_video = process.env.CBT_RECORD_NETWORK.match(
            /true/i
        );
    if (process.env.CBT_MAX_DURATION) {
        capabilities.max_duration = process.env.CBT_MAX_DURATION;
    }

    return capabilities;
}

export function getUsername() {
    return process.env['CBT_USERNAME'];
}

export function getAuthkey() {
    return process.env['CBT_AUTHKEY'];
}

export async function getBrowserList() {
    const browserList = JSON.parse(await doRequest(CBT_API_PATHS.browserList));

    let browserNames = browserList.map((info) => {
        if (info['device'] === 'mobile') {
            let name = info['browsers'][0]['type'];
            let version = info['caps'].platformVersion;
            let OS = info['caps'].deviceName;
            return `${name}@${version}:${OS}`;
        }

        let arrList = [];
        let OS = info['name'];

        for (var i = 0; i < info['browsers'].length; i++) {
            let name = info['browsers'][i]['type'];
            let version = info['browsers'][i]['version'];
            arrList.push(`${name}@${version}:${OS}`);
        }
        return arrList;
    });

    return flatten(browserNames);
}

export function doRequest(apiPath) {
    var url = apiPath.url;

    var opts = {
        auth: {
            user: getUsername(),
            pass: getAuthkey(),
        },

        method: apiPath.method || 'GET',
    };

    return request(url, opts).catch((error) => {
        console.error(error);
        throw error;
    });
}
