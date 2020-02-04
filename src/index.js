/*eslint camelcase: ["error", {properties: "never"}]*/

import { flatten } from 'lodash';
import request from 'request-promise';
import Debug from 'debug';
import wd from 'wd';
import { startTunnel, stopTunnel } from './tunnel';

var openedBrowsers = {};
var webDriverBrowser;

wd.configureHttp({
    timeout: 9 * 60 * 1000,
    retries: 3,
});

const debug = Debug('testcafe-cbt');
const AUTH_FAILED_ERROR =
    'Authentication failed. Please assign the correct username and access key ' +
    'to the CBT_TUNNELS_USERNAME and CBT_TUNNELS_AUTHKEY environment variables.';

const CBT_API_PATHS = {
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

function doRequest(apiPath) {
    var url = apiPath.url;

    var opts = {
        auth: {
            user: process.env['CBT_TUNNELS_USERNAME'],
            pass: process.env['CBT_TUNNELS_AUTHKEY'],
        },

        method: apiPath.method || 'GET',
    };

    return request(url, opts).catch((error) => {
        console.error(error);
        throw error;
    });
}

async function startBrowser(id, url, capabilities) {
    try {
        await startTunnel();
    } catch (e) {
        console.error('unable to start tunnel', e);
        throw e;
    }

    webDriverBrowser = wd.promiseChainRemote(
        'hub.crossbrowsertesting.com',
        80,
        process.env['CBT_TUNNELS_USERNAME'],
        process.env['CBT_TUNNELS_AUTHKEY']
    );
    openedBrowsers[id] = webDriverBrowser;

    try {
        debug('starting', JSON.stringify(capabilities, undefined, 2));
        //The environment you requested was unavailable.
        await webDriverBrowser.init(capabilities).get(url);
        const pingWebDriver = () => webDriverBrowser.eval('');

        webDriverBrowser.once('status', () => {
            webDriverBrowser.pingIntervalId = setInterval(
                pingWebDriver,
                30 * 1000
            );
        });
    } catch (error) {
        console.error('failed running tests!');
        throw error;
    }
}

async function _dispose() {
    debug('_dispose');

    const seleniumTestHistory = JSON.parse(
        await doRequest(CBT_API_PATHS.seleniumTestHistory)
    );
    if (seleniumTestHistory.meta.record_count >= 1) {
        for (let i = 0; i < seleniumTestHistory.meta.record_count; i++) {
            const seleniumTestID =
                seleniumTestHistory.selenium[i].selenium_test_id;
            await doRequest(CBT_API_PATHS.deleteBrowser(seleniumTestID));
        }
    }
    await stopTunnel();
}

process.on('exit', async (_code) => {
    await stopTunnel();
});

export default {
    // Multiple browsers support
    isMultiBrowser: true,
    platformsInfo: [],
    browserNames: [],

    async _getDeviceList() {
        this.myArr = JSON.parse(await doRequest(CBT_API_PATHS.browserList));

        this.browserNames = this.myArr.map((info) => {
            if (info['device'] === 'mobile') {
                this.name = info['browsers'][0]['type'];
                this.version = info['caps'].platformVersion;
                this.OS = info['caps'].deviceName;
                return `${this.name}@${this.version}:${this.OS}`;
            }

            this.arrList = [];
            this.OS = info['name'];

            for (var i = 0; i < info['browsers'].length; i++) {
                this.name = info['browsers'][i]['type'];
                this.version = info['browsers'][i]['version'];
                this.arrList.push(`${this.name}@${this.version}:${this.OS}`);
            }
            return this.arrList;
        });

        this.browserNames = flatten(this.browserNames);
    },

    // Required - must be implemented
    // Browser control
    async openBrowser(id, pageUrl, browserName) {
        console.warn(`opening: ${browserName} with id: ${id}`);
        if (
            !process.env['CBT_TUNNELS_USERNAME'] ||
            !process.env['CBT_TUNNELS_AUTHKEY']
        ) {
            throw new Error(AUTH_FAILED_ERROR);
        }

        var colon = browserName.indexOf(':');

        if (colon > -1) {
            var platform = browserName.substr(colon + 1);

            browserName = browserName.substr(0, colon);
        }
        var at = browserName.indexOf('@');

        if (at > -1) {
            var version = browserName.substr(at + 1);

            browserName = browserName.substr(0, at);
        }

        var capabilities;

        if (
            browserName !== 'Chrome Mobile' &&
            browserName !== 'Mobile Safari'
        ) {
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
            capabilities.record_video = process.env.CBT_RECORD_VIDEO.match(
                /true/i
            );
        if (process.env.CBT_RECORD_NETWORK)
            capabilities.record_video = process.env.CBT_RECORD_NETWORK.match(
                /true/i
            );
        if (process.env.CBT_MAX_DURATION)
            capabilities.max_duration = process.env.CBT_MAX_DURATION;

        if (
            browserName.indexOf('Chrome') !== -1 &&
            process.env.CBT_CHROME_ARGS &&
            process.env.CBT_CHROME_ARGS.length > 0
        )
            capabilities.chromeOptions = {
                args: [process.env.CBT_CHROME_ARGS],
            };

        await startBrowser(id, pageUrl, capabilities);
    },

    async closeBrowser(id) {
        clearInterval(this.openedBrowsers[id].pingIntervalId);
        await openedBrowsers[id].quit();
    },

    // Optional - implement methods you need, remove other methods
    // Initialization
    async init() {
        if (
            !process.env['CBT_TUNNELS_USERNAME'] ||
            !process.env['CBT_TUNNELS_AUTHKEY']
        )
            throw new Error(AUTH_FAILED_ERROR);

        await this._getDeviceList();
    },

    async dispose() {
        _dispose();
        await stopTunnel();
    },

    // Browser names handling
    getBrowserList() {
        return this.browserNames;
    },

    async isValidBrowserName(/* browserName */) {
        return true;
    },

    // Extra methods
    async resizeWindow(id, width, height /*, currentWidth, currentHeight*/) {
        await openedBrowsers[id].setWindowSize(width, height);
    },

    async maximizeWindow(id) {
        await openedBrowsers[id].maximize();
    },

    async takeScreenshot(/* id, screenshotPath, pageWidth, pageHeight */) {
        console.warn(
            'The screenshot functionality is not supported by the "crossbrowsertesting" browser provider.'
        );
    },
};
