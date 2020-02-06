import Debug from 'debug';
import wd from 'selenium-webdriver';
import { startTunnel, stopTunnel } from './tunnel';
import {
    setScore,
    getUsername,
    getAuthkey,
    getBrowserList as _getBrowserList,
    getCapabilities,
    doRequest,
    CBT_API_PATHS,
} from './utils';

/**@type {{[key:string]: import('selenium-webdriver').ThenableWebDriver}} */
const openedBrowsers = {};
/**@type {{[key:string]: string}} */
const sessionIds = {};

const debug = Debug('testcafe-cbt');
const AUTH_FAILED_ERROR =
    'Authentication failed. Please assign the correct username and access key ' +
    'to the CBT_USERNAME and CBT_AUTHKEY environment variables.';

async function startBrowser(id, url, capabilities) {
    const username = getUsername();
    const authkey = getAuthkey();

    const platform = capabilities.platform || '';
    const isHeadless = platform.toLowerCase().includes('headless');
    const remoteHeadlessHub =
        'https://hub-cloud.crossbrowsertesting.com:443/wd/hub';
    const remoteHub = 'http://hub.crossbrowsertesting.com:80/wd/hub';

    const server = isHeadless ? remoteHeadlessHub : remoteHub;

    debug(
        'starting',
        JSON.stringify(capabilities, undefined, 2),
        `on ${server}`
    );

    capabilities.username = username;
    capabilities.password = authkey;

    const webDriverBrowser = new wd.Builder()
        .usingServer(server)
        .withCapabilities(capabilities)
        .build();

    try {
        const session = await webDriverBrowser.getSession();
        const sessionId = session.getId();
        sessionIds[id] = sessionId;
        debug(
            `Running at: https://app.crossbrowsertesting.com/selenium/${sessionId}`
        );

        await webDriverBrowser.get(url);
        debug(`${id}: browser opened`);
        openedBrowsers[id] = webDriverBrowser;
    } catch (error) {
        throw error;
    }
}

async function _dispose() {
    debug('dispose');

    const seleniumTestHistory = JSON.parse(
        await doRequest(CBT_API_PATHS.seleniumTestHistory)
    );
    if (seleniumTestHistory.meta.record_count >= 1) {
        for (let i = 0; i < seleniumTestHistory.meta.record_count; i++) {
            const seleniumTestID =
                seleniumTestHistory.selenium[i].selenium_test_id;

            debug(`${seleniumTestID}: deleting browser`);
            await doRequest(CBT_API_PATHS.deleteBrowser(seleniumTestID));
        }
    } else {
        debug('no browsers to stop');
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

    // Required - must be implemented
    // Browser control
    async openBrowser(id, pageUrl, browserName) {
        try {
            await startTunnel();
        } catch (e) {
            console.error('unable to start tunnel', e);
            throw e;
        }
        console.warn(`opening: ${browserName} with id: ${id}`);
        if (!getUsername() || !getAuthkey()) {
            throw new Error(AUTH_FAILED_ERROR);
        }

        const capabilities = getCapabilities({
            id,
            browserName,
        });

        await startBrowser(id, pageUrl, capabilities);
    },

    async closeBrowser(id) {
        debug(`${id}: closing`);
        await openedBrowsers[id].quit();
    },

    // Optional - implement methods you need, remove other methods
    // Initialization
    async init() {
        if (!getUsername() || !getAuthkey()) {
            throw new Error(AUTH_FAILED_ERROR);
        }

        // start tunnel?
    },

    async dispose() {
        await _dispose();
        await stopTunnel();
    },

    // Browser names handling
    getBrowserList() {
        return _getBrowserList();
    },

    async isValidBrowserName(/* browserName */) {
        return true;
    },

    // Extra methods
    async resizeWindow(id, width, height, currentWidth, currentHeight) {
        debug(
            `${id}: resizeWindow - ${currentWidth}x${currentHeight} to ${width}x${height}`
        );
        const browser = openedBrowsers[id];
        await browser
            .manage()
            .window()
            .setRect({
                width,
                height,
            });
    },

    async maximizeWindow(id) {
        debug(`${id}: maximizeWindow()`);
        await openedBrowsers[id]
            .manage()
            .window()
            .maximize();
    },

    async reportJobResult(id, jobResult, jobData) {
        debug(`${id}: ${jobResult}, ${JSON.stringify(jobData, null, 2)}`);

        const { total, passed } = jobData;
        const score = total === passed ? 'pass' : 'fail';
        const sessionId = sessionIds[id];

        await setScore({ sessionId, score }).then(function() {
            debug(`${id}: set score to ${score}`);
        });
    },
    async takeScreenshot(/* id, screenshotPath, pageWidth, pageHeight */) {
        console.warn(
            'The screenshot functionality is not supported by the "crossbrowsertesting" browser provider.'
        );
    },
};
