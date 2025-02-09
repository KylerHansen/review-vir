import {extractErrorMessage} from '@augment-vir/common';
import {
    asyncProp,
    classMap,
    css,
    defineElementNoInputs,
    html,
    isError,
    isResolved,
    listen,
    nothing,
} from 'element-vir';
import {isJsonEqual} from 'run-time-assertions';
import {LoaderAnimated24Icon, ViraIcon} from 'vira';
import {globalVars} from '../../data/global-vars';
import {
    ReviewVirFullRoute,
    ReviewVirMainPath,
    createReviewVirRouter,
    defaultReviewVirFullRoute,
} from '../../data/routing/vir-route';
import {
    WebClientInterface,
    loadWebClientInterface,
} from '../../services/web-client-interface/web-client-interface';
import {ChangeRouteEvent} from '../events/change-route.event';
import {VirAppTabs} from './app-tabs/vir-app-tabs.element';
import {VirErrorMessage} from './common-elements/vir-error-message.element';
import {VirAuthTokenEntryMainPage} from './main-page-elements/auth-token-entry-main-page/vir-auth-token-entry-main-page.element';
import {VirPullRequestsMainPage} from './main-page-elements/pull-requests-main-page/vir-pull-requests-main-page.element';

export const VirReviewVirApp = defineElementNoInputs({
    tagName: 'vir-review-vir-app',
    styles: css`
        :host,
        .root {
            display: flex;
            flex-direction: column;
            min-height: 100%;
            width: 100%;
            box-sizing: border-box;
            font-family: sans-serif;
            gap: 16px;
        }

        .hide-main-page {
            display: none;
        }

        ${VirAuthTokenEntryMainPage} {
            align-self: flex-start;
        }
    `,
    stateInitStatic: {
        serviceAuthTokens: asyncProp({
            updateCallback({
                secretEncryptionKey,
                webClientInterface,
            }: {
                secretEncryptionKey: string | undefined;
                webClientInterface: WebClientInterface;
            }) {
                if (!secretEncryptionKey) {
                    throw new Error('No encryption key.');
                }

                return webClientInterface.authStore.loadServiceAuthTokens({
                    secretEncryptionKey,
                });
            },
        }),
        webClientInterface: asyncProp({defaultValue: loadWebClientInterface()}),
        router: createReviewVirRouter(),
        currentRoute: undefined as Readonly<ReviewVirFullRoute> | undefined,
    },
    initCallback({state, updateState}) {
        state.router.addRouteListener(true, (route) => {
            updateState({currentRoute: route});
        });
    },
    renderCallback({state}) {
        const webClientInterface = state.webClientInterface.value;

        if (!isResolved(webClientInterface)) {
            return html`
                <${ViraIcon.assign({icon: LoaderAnimated24Icon})}></${ViraIcon}>
            `;
        } else if (isError(webClientInterface)) {
            return html`
                <${VirErrorMessage}>${extractErrorMessage(webClientInterface)}</${VirErrorMessage}>
            `;
        }

        state.serviceAuthTokens.update({
            secretEncryptionKey: globalVars.encryptionKey,
            webClientInterface,
        });
        const serviceAuthTokens = state.serviceAuthTokens.value;

        if (!isResolved(serviceAuthTokens)) {
            return html`
                <${ViraIcon.assign({icon: LoaderAnimated24Icon})}></${ViraIcon}>
            `;
        } else if (isError(serviceAuthTokens)) {
            return html`
                <${VirErrorMessage}>${extractErrorMessage(serviceAuthTokens)}</${VirErrorMessage}>
            `;
        }

        const currentRoute: Readonly<ReviewVirFullRoute> =
            Object.keys(serviceAuthTokens).length === 0
                ? {
                      ...defaultReviewVirFullRoute,
                      paths: [ReviewVirMainPath.Auth],
                  }
                : state.currentRoute || defaultReviewVirFullRoute;

        if (!isJsonEqual(currentRoute, state.currentRoute)) {
            state.router.setRoutes(currentRoute);
        }

        const mainContentTemplate =
            currentRoute.paths[0] === ReviewVirMainPath.Auth
                ? html`
                      <${VirAuthTokenEntryMainPage.assign({
                          authTokens: serviceAuthTokens,
                      })}
                          ${listen(
                              VirAuthTokenEntryMainPage.events.authTokensByServiceChange,
                              async (event) => {
                                  webClientInterface.authStore.saveServiceAuthTokens({
                                      secretEncryptionKey: globalVars.encryptionKey,
                                      authTokensByService: event.detail,
                                  });

                                  state.serviceAuthTokens.setValue(event.detail);
                              },
                          )}
                      ></${VirAuthTokenEntryMainPage}>
                  `
                : nothing;

        return html`
            <div
                class="root"
                ${listen(ChangeRouteEvent, (event) => {
                    state.router.setRoutes(event.detail.route);
                })}
            >
                <${VirAppTabs.assign({
                    currentRoute,
                    router: state.router,
                })}></${VirAppTabs}>
                ${mainContentTemplate}
                <${VirPullRequestsMainPage.assign({
                    serviceAuthTokens,
                    webClientInterface,
                })}
                    class=${classMap({
                        /**
                         * Don't swap out this template, just hide it, because we want to keep it
                         * loaded.
                         */
                        'hide-main-page': currentRoute.paths[0] !== ReviewVirMainPath.PullRequests,
                    })}
                ></${VirPullRequestsMainPage}>
            </div>
        `;
    },
});
