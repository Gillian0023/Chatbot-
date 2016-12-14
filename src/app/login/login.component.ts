import { Component } from '@angular/core';
import { Http, Response } from '@angular/http';
import { Observable } from 'rxjs';
import { circuit } from 'circuit'

import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';



@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
})
export class LoginComponent {
    title = 'Contextual Collaboration';

    observable$: Observable<{}>;

    constructor(http: Http) {
        this.observable$ = http
            .get('/api/public/simple')
            .map((response: Response) => response.json());
    }
    
    
    var app = angular.module('circuit.sdk.examples', []);
    app.controller('ctrl', ['$rootScope', '$scope','$sce', function($rootScope, $scope, $sce) {
    $scope.domain = 'sdk.circuitsandbox.net';
    $scope.localUser = null;
    $scope.email = 'jilin0023@gmail.com';
    $scope.password = 'gP3thMSxwQJ66YU2';
    $scope.registrationState = null;
    $scope.conversations = [];
    $scope.users = [];
    $scope.items = [];
    $scope.createMode = false;
    $scope.selectedUsers = [];
    var $fileToUpload = document.getElementById('fileToUpload');
    var _isInitialized = false;
    var _searchId;
    var _selectedConvId;
    // Create a new Circuit SDK client
    var client = null;
    $scope.login = function () {
        if (client) {
            return;
        }

        client = new Circuit.Client({domain: $scope.domain});
        client.logon($scope.email, $scope.password).then(function (user) {
            $scope.localUser = user;
            setupEventListeners(user);
        }).then(function () {
            // Retrieve newest 20 conversations
            return client.getConversations({numberOfConversations: 20});
        }).then(function (conversations) {
            _isInitialized = true;
            if (!conversations.length) {
                // The user has no conversations
                $scope.selectedConv = null;
                return;
            }
            // Save conversations in scope and pass first conversation to next promise chain element
            $scope.conversations = conversations.reverse();
            $scope.selectedConv = $scope.conversations[0];
            _selectedConvId = $scope.selectedConv.convId;
            return getItems();
        }).then(function (items) {
            if (items) {
                console.log('Loaded item count: ', items.length);
            }
            $scope.$apply();
        }).catch(function (err) {
            if (!$scope.localUser) {
                client = null;
            }
            if (err) {
                return alert('Error: ' + err.message);
            }
        });
    }
    $scope.logout = function () {
        if (!client) {
            return;
        }
        client.logout();
        client.removeAllListeners();
        client = null;
        $scope.localUser = null;
        $scope.selectedConv = null;
        $scope.conversations = [];
        $scope.items = [];
    }
    $scope.setFiles = function (element) {
        $scope.$apply(function (scope) {
            console.log('files:', element.files);
            $scope.files = []
            for (var i = 0; i < element.files.length; i++) {
                $scope.files.push(element.files[i])
            }
        });
    };
    $scope.send = function () {
        $scope.sending = true;
        client.addTextItem($scope.selectedConv.convId,
            {content: $scope.message, attachments: $scope.files}).then(function (item) {
            $scope.message = null;
            $fileToUpload.value = '';
            $scope.files = [];
        });
    }
    $scope.createConversation = function () {
        $scope.createMode = false;
        var members = $scope.selectedUsers.map(function (m) {
            return m.userId;
        });
        client.createGroupConversation(members, $scope.title).then(function (conv) {
            $rootScope.$apply(function () {
                $scope.conversations.unshift(conv);
                $scope.selectedConv = conv;
            });
        }).catch(function (err) {
            console.log(err);
        });
        $scope.selectedUsers = [];
    }
    $scope.getConvName = function (conv) {
        if (!conv) {
            return '';
        }
        return conv.title || conv.participantFirstNames || conv.participants[0].displayName;
    }
    $scope.search = function (query) {
        if (!query) {
            $scope.users = [];
            return;
        }
        client.startUserSearch({query: query}).then(function (searchId) {
            _searchId = searchId;
        });
    }
    $scope.selectUser = function (user) {
        if ($scope.selectedUsers.indexOf(user) === -1) {
            $scope.selectedUsers.unshift(user);
        }
        if ($scope.selectedUsers.length < 2) {
            $scope.title = null;
        }
    }
    $scope.deselectUser = function (user) {
        $scope.selectedUsers.remove(user);
    }
    $scope.$watch('selectedConv', function (newValue, oldValue) {
        if (newValue && oldValue && newValue.convId === oldValue.convId) {
            return;
        }
        if (newValue && _isInitialized) {
            _selectedConvId = newValue.convId
            getItems();
        }
    });
    function updateOrAddConversation(conv) {
        var exists = $scope.conversations.some(function (c, idx) {
            if (c.convId === conv.convId) {
                $scope.conversations[idx] = conv;
                if (c.convId === _selectedConvId) {
                    $scope.selectedConv = conv;
                }
                return true;
            }
        });
        if (!exists) {
            $scope.conversations.unshift(conv);
        }
    }

    function setupEventListeners(user) {
        client.addEventListener('registrationStateChange', function (evt) {
            $scope.$apply(function () {
                $scope.registrationState = evt.state;
                if (evt.state === Circuit.Enums.RegistrationState.Disconnected) {
                    $scope.logout();
                }
            });
        });
        client.addEventListener('itemAdded', function (evt) {
            if (evt.item.convId === _selectedConvId) {
                getItems().then(function (items) {
                    $scope.$apply(function () {
                        $scope.sending = false;
                    });
                });
            }
        });
        client.addEventListener('itemUpdated', function (evt) {
            if (evt.item.convId === _selectedConvId) {
                getItems();
            }
        });
        client.addEventListener('conversationCreated', function (evt) {
            $scope.$apply(function () {
                updateOrAddConversation(evt.conversation);
            });
        });
        client.addEventListener('conversationUpdated', function (evt) {
            $scope.$apply(function () {
                updateOrAddConversation(evt.conversation);
            });
        });
        client.addEventListener('basicSearchResults', function (evt) {
            if (_searchId === evt.data.searchId) {
                // For better performance more specific searches (i.e. another char is typed)
                // instead of fetching the users again the prior list should be filtered.
                client.getUsersById(evt.data.users).then(function (users) {
                    $rootScope.$apply(function () {
                        $scope.users = users;
                    });
                });
            }
        });
    }

    function getItems() {
        return new Promise(function (resolve, reject) {
            if (!_selectedConvId) {
                reject('No conversation selected');
                return;
            }
            client.getConversationItems(_selectedConvId).then(function (items) {
                $scope.$apply(function () {
                    $scope.items = items;
                    $scope.items.forEach(function (i) {
                        trustItem(i);
                    });
                    resolve(items);
                });
            }, function (reason) {
                console.log('Error retrieving items. Reason: ', reasons);
                reject(reason);
            });
        });
    }

    function trustItem(item) {
        switch (item.type) {
            case Circuit.Constants.ConversationItemType.SYSTEM:
                item.trustedText = $sce.trustAsHtml(item.system.type);
                break;
            case Circuit.Constants.ConversationItemType.TEXT:
                item.trustedText = $sce.trustAsHtml(item.text.content.replace(/<hr>/g, ' '));
                break;
            case Circuit.Constants.ConversationItemType.RTC:
                item.trustedText = $sce.trustAsHtml(item.rtc.type);
                break;
        }
    }

    if (typeof Circuit === 'undefined') {
        $scope.error = 'Could not load SDK (circuit.js). Make sure Circuit is running on https://localhost:8094.';
    } else {
        // The conversation injector example needs to be asynchroneous since the
        // user lookup is an API call.
        Circuit.Injectors.conversationInjector = function (conversation) {
            return new Promise(function (resolve, reject) {
                var userIds = conversation.participants.filter(function (p) {
                    return p !== client.loggedOnUser.userId;
                });
                client.getUsersById(userIds).then(function (users) {
                    // Set conversation.otherUsers
                    conversation.otherUsers = users;
                    // Set conversation.title and firstName
                    if (conversation.type === 'DIRECT') {
                        conversation.title = conversation.otherUsers[0].displayName;
                    } else {
                        var firstNames = conversation.otherUsers.map(function (u) {
                            return u.firstName;
                        });
                        firstNames.push(client.loggedOnUser.firstName);
                        conversation.participantFirstNames = firstNames.join(', ');
                        conversation.title = conversation.topic || conversation.otherUsers.map(function (u) {
                                return u.displayName;
                            }).join(', ');
                    }
                    resolve(conversation);
                }, function (err) {
                    reject(err);
                });
            });
        }
        Circuit.Injectors.itemInjector = function (item) {
            item.sentByMe = (item.creatorId === client.loggedOnUser.userId);
            if (item === client.loggedOnUser.userId) {
                item.creator = client.loggedOnUser;
            } else if ($scope.selectedConv && $scope.selectedConv.otherUsers) {
                item.creator = $scope.selectedConv.otherUsers.find(function (u) {
                    return u.userId === item.creatorId;
                });
            }
            if (item.type === 'TEXT') {
                // Replacing br and hr tags with a space
                item.text.content = item.text.content.replace(/<(\/li|hr[\/]?)>/gi, ' ');
            }
        };
    }


}

}