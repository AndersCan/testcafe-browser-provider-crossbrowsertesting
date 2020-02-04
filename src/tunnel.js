import chalk from 'chalk';

// @ts-ignore
import cbt from 'cbt_tunnels';
let tunnul_is_started = false;

let start_tunnel_promise = undefined;
export const startTunnel = async (tunnelName = `${Math.random()}`.slice(2)) => {
    if (start_tunnel_promise) {
        return start_tunnel_promise;
    } else if (tunnul_is_started) {
        return Promise.resolve();
    }

    const config = getSecretConfig();
    if (!config) {
        throw new Error('no CBT config');
    }
    const username = config.crossBrowser.userName;
    const authKey = config.crossBrowser.authKey;

    const tunnelPromise = new Promise((resolve, reject) => {
        console.log(chalk.green(`Starting CBT tunnel (${tunnelName})...`));

        cbt.start(
            {
                username,
                authkey: authKey,
                tunnelname: tunnelName,
                verbose: false,
            },
            (error) => {
                start_tunnel_promise = undefined;
                if (error) {
                    console.log(chalk.red('Failed.'));
                    reject(error);
                } else {
                    console.log(chalk.green('Done.'));
                    tunnul_is_started = true;
                    resolve();
                }
            }
        );
    });
    start_tunnel_promise = tunnelPromise;
    return tunnelPromise;
};

let stop_tunnel_promise = undefined;
export const stopTunnel = async () => {
    if (stop_tunnel_promise) {
        return stop_tunnel_promise;
    } else if (tunnul_is_started === false) {
        return Promise.resolve();
    }
    console.log(chalk.yellow(`Stopping CBT tunnel... `));
    const stopPromise = new Promise((resolve) => {
        cbt.stop((error) => {
            stop_tunnel_promise = undefined;
            if (error) {
                console.log(chalk.red('Failed:'));
                console.error(error);
                start_tunnel_promise = true;
            } else {
                console.log(chalk.green('Done.'));
                tunnul_is_started = false;
            }
            resolve();
        });
    });
    stop_tunnel_promise = stopPromise;
    return stopPromise;
};

async function main() {
    await startTunnel(...process.argv.slice(2));

    process.on('SIGINT', () => {
        stopTunnel();
    });

    console.log('Press Ctrl/Cmd-C to stop.');
}

if (process.mainModule === module) {
    main();
}

export function getSecretConfig() {
    const CBT_USERNAME = process.env.CBT_TUNNELS_USERNAME;
    const CBT_AUTHKEY = process.env.CBT_TUNNELS_AUTHKEY;

    if (CBT_USERNAME && CBT_AUTHKEY) {
        return {
            crossBrowser: {
                userName: CBT_USERNAME,
                authKey: CBT_AUTHKEY,
            },
        };
    }
}
