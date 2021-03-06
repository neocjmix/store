import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import Path from './path'
import Navigate from './navigate'
import traverse from './traverse'
import Queue from './queue'

const MAX_RECURSION = 20;
const noChange = new (function NoChange(){})();
const deleted = new (function Deleted(){})();
const _storeRegistry = {};

function _shouldChanged(value){
    return value !== noChange;
}

function _shouldDeleted(value){
    return value === deleted
}

function _arrayEquals(array1, array2) {
    if(array1.length !== array2.length) return false;
    for(let i=0,length = array1.length; i < length; i++){
        if(array1[i] !== array2[i]){
            return false;
        }
    }
    return true;
}

function _registerEvents(eventRegistry, eventPaths) {
    const eventName = eventPaths.join(",");
    _.forEach(eventPaths, function (path) {
        eventRegistry[path] = eventRegistry[path] || {};
        eventRegistry[path][eventName] = eventRegistry[path][eventName] + 1 || 1;
    });
    return eventName;
}

function _Thenable(eventEmitter, eventRegistry, paths, immediateValues) {
    let isMuted;
    return {
        paths : paths,
        immediateValues : immediateValues,
        then : function(callback){
            const eventName = _registerEvents(eventRegistry, paths);
            eventEmitter.on(eventName, function () {
                if (isMuted) return;
                callback.apply(this, arguments);
            });

            if (immediateValues) {
                callback.apply(this, immediateValues);
            }
            return this;
        },
        merge : function(thenable){
            let v;
            if(immediateValues){
                const values1 = immediateValues.slice(0,-1);
                const values2 = thenable.immediateValues.slice(0,-1);
                const newCommit = _.assign(immediateValues.slice(-1)[0], {
                    message : immediateValues.slice(-1)[0].message + "," +
                    thenable.immediateValues.slice(-1)[0].message
                });
                v = values1.concat(values2).concat([newCommit]);
            }


            return _Thenable(eventEmitter, eventRegistry, paths.concat(thenable.paths), v);
                // eventName+","+thenable.eventName,
                // values1.concat(values2).concat([newCommit]));
        },
        silently : function(){
            return _Thenable(eventEmitter, eventRegistry, paths);
        },
        mute : function(){
            isMuted = true;
        }
    }
}

function _patch(state, patch) {
    const changedPaths = [];
    const newState = traverse(patch, function (newValue, currentPath, childValues) {
        const changedChildValues = _.pick(childValues, _shouldChanged);
        const deletedChildValues = _.pick(childValues, _shouldDeleted);
        const currentProperty = Navigate(state).path(currentPath);
        const oldValue = currentProperty.get();

        //TODO 조건문 정리
        if(_.isArray(newValue)) {
            newValue = newValue.slice();
            if (_.isArray(oldValue) && _arrayEquals(oldValue, newValue)) return noChange;
        }else{
            if (oldValue === newValue) return noChange;
        }

        if (!_.isUndefined(oldValue) && _.isUndefined(newValue)) {
            traverse(oldValue, function(value, path){
                changedPaths.push(currentPath.path(path));
            });
            return deleted;
        }

        if (_.isPlainObject(newValue) && !_.isEmpty(newValue) && _.isEmpty(changedChildValues) && _.isEmpty(deletedChildValues)) return noChange;

        //기존 값이 객체/배열일때는 childValues를 적용
        if (!_.isEmpty(changedChildValues) || !_.isEmpty(deletedChildValues)){
            if(_.isPlainObject(oldValue)){
                //추가/변경
                newValue = _.assign({}, oldValue, changedChildValues);
                //삭제
                _.forEach(_.keys(deletedChildValues), function(key){
                    const objToDelete = currentProperty.path(key).get();
                    if(_.isPlainObject(objToDelete)){
                        traverse(objToDelete, function(obj, localPath){
                            changedPaths.push(currentPath.path(key).path(localPath));
                        })
                    }
                    delete newValue[key]
                })
            }else if(_.isArray(oldValue)){
                newValue = [].slice.apply(oldValue);
                _.forEach(childValues, function(value, key){
                    newValue[key] = value;
                });
            }else{
                newValue = changedChildValues;
            }
        }

        //이벤트 발생시킬 path 추가
        changedPaths.push(currentPath);
        return newValue;
    });

    return {
        changedPaths :  changedPaths,
        state : newState
    };
}

function _replace(state, patch, basePath) {
    const changedPaths = [];

    let isRelatedWithBasePath = function (currentPath) {
        return basePath.contains(currentPath) ||
            currentPath.contains(basePath) ||
            currentPath.equals(basePath);
    };
    const newState = traverse(state, function(oldValue, currentPath, childFields){
        let newValue = Navigate(patch).path(currentPath).get();
        const changedfields = _.pick(childFields, _shouldChanged);
        const deletedFields = _.pick(childFields, _shouldDeleted);

        //noChange
        if(oldValue === newValue) return noChange;
        if(basePath && !isRelatedWithBasePath(currentPath)) return noChange;

        //delete
        if(_.isUndefined(newValue) && !_.isUndefined(oldValue)){
            changedPaths.push(currentPath);
            return deleted;
        }

        //object
        if (_.isPlainObject(newValue)){
            if(_.isPlainObject(oldValue) && !_.isEmpty(oldValue)){
                const addedFields = _.pick(newValue, function(value, key){
                    return !_.isUndefined(value) && _.isUndefined(oldValue[key]);
                });

                if (_.isEmpty(changedfields) && _.isEmpty(deletedFields) && _.isEmpty(addedFields)) return noChange;

                const valueAdded = _.assign({}, oldValue, changedfields, addedFields);
                newValue = _.omit(valueAdded, _.keys(deletedFields));
                changedPaths.push(currentPath);
            }else{
                traverse(newValue, function(obj, localPath){
                    changedPaths.push(currentPath.path(localPath));
                })
            }
        }

        //array
        if(_.isArray(oldValue)){
            if (_.isArray(newValue)){
                if(_arrayEquals(oldValue, newValue)) return noChange;
                newValue = newValue.slice();
            }else if(childFields){
                newValue = oldValue.slice();
                _.forEach(childFields, function(value, key) {
                    newValue[key] = value;
                });
            }
            changedPaths.push(currentPath);
        }

        return newValue;
    }, { array : true });

    return {
        changedPaths :  changedPaths,
        state : newState
    };
}


function stackTrace(commit, max){
    max = max || 10;
    const stack = [];
    while(commit.cause && stack.length <= max){
        stack.push(commit.depth + " : " + commit.message);
        commit = commit.cause;
    }
    return stack.join("\n")
}

function Store(storeId, initState, pathString, eventEmitter){
    let _state = initState || {};
    const _callbackStack = [];
    const _callbackQueue = new Queue();
    const _path = _.isUndefined(pathString) ? "" : Path(pathString);
    const _parentStore = _.isFunction(initState.subscribe) && _.isFunction(initState.commit) ? initState : undefined;
    const _eventEmitter = eventEmitter || new EventEmitter();
    const _eventRegistry = {};

    function _schedule(commit, callback){
        if(_callbackStack.length > 0){
            if(commit.depth >= MAX_RECURSION){
                _callbackQueue.dequeueAll(function (dequeued) {
                    dequeued();
                });
                while(_callbackStack.length > 0) _callbackStack.pop();
                throw new Error("too much recursive commits : \n" + stackTrace(commit));
            }
            _callbackQueue.enqueue(function(){
                _callbackStack.push(commit);
                callback(commit);
                _callbackStack.pop();
            });
        }else{
            _callbackStack.push(commit);
            callback(commit);
            _callbackQueue.dequeueAll(function (dequeued) {
                dequeued();
            });
            _callbackStack.pop();
        }
    }

    function _emitEvent(commit, eventPaths) {
        _.forEach(eventPaths, function (eventPath) {
            const eventArguments = _.map(eventPath.split(","), function (path) {
                return Navigate(_state).path(path).get();
            });
            _eventEmitter.emit.apply(_eventEmitter, [eventPath].concat(eventArguments).concat([commit]));
        });
    }

    const instance = {
        getId : function(){
            return storeId;
        },
        isSubStore: function () {
            return _parentStore && _path;
        },
        subscribe : function(...paths){
            if(paths.length === 0) paths.push("");
            if(this.isSubStore()) {
                return _parentStore.subscribe(...paths.map(function(path){
                    return _path.path(path).toString();
                }))
            }

            return _Thenable(_eventEmitter, _eventRegistry, paths, paths.map(path => Navigate(_state).path(path).get()).concat({
                // message: "subscribing [" + eventName + "]", //TODO
                message: "subscribing",
                patch: undefined //TODO
            }));
        },
        commit : function (message, patch){
            if(!_.isString(message)) {
                throw new TypeError("missing commit message");
            }

            if (this.isSubStore()) {
                if(_.isFunction(patch)){
                    return _parentStore.commit(message, function(value){
                        return Navigate({}).path(_path).set(patch(Navigate(value).path(_path).get()));
                    });
                }else{
                    const pathedPatch = _path.toString() === "" ? patch : Navigate({}).path(_path).set(patch);
                    return _parentStore.commit(message, pathedPatch);
                }
            }

            if(_.isFunction(patch)){
                patch = patch(Navigate(_state).path(_path).get());
            }

            const cause = _.last(_callbackStack);

            _schedule({
                message : message,
                patch : patch,
                mode : "commit",
                cause : cause,
                depth : cause ? cause.depth + 1 : 0
            },function(commit){
                try{
                    const result = _patch(_state, patch);
                    if(_shouldChanged(result.state)) _state = result.state === deleted ? undefined : result.state;

                    const eventPaths = _(result.changedPaths)
                        .filter(function(changedPath) {
                            return _eventRegistry[changedPath];
                        })
                        .map(function(changedPath){
                            return _.keys(_eventRegistry[changedPath]);
                        })
                        .reduce(function(eventPaths1, eventPaths2){
                            return _.union(eventPaths1, eventPaths2);
                        });


                    if(eventPaths) _emitEvent(commit, eventPaths);
                }catch (error){
                    error.message = "error while commit ["+ message +"] caused by\n" + error.message;
                    throw error;
                }
            });
        },
        reset : function(message, patch, basePath){
            if(!_.isString(message)) throw new TypeError("missing reset message");
            if (this.isSubStore()) {
                const pathedPatch = _path.toString() === "" ? patch : Navigate({}).path(_path).set(patch);
                return _parentStore.reset(message, pathedPatch, _path.path(basePath));
            }

            const cause = _.last(_callbackStack);

            _schedule({
                message : message,
                patch : patch,
                mode : "reset",
                cause : cause,
                depth : cause ? cause.depth + 1 : 0
            }, function(commit) {
                try {
                    const result = _replace(_state, patch, basePath);
                    if (_shouldChanged(result.state)) {
                        _state = result.state;
                    }
                    const eventPaths = _(result.changedPaths)
                        .filter(function (changedPath) {
                            return _eventRegistry[changedPath];
                        })
                        .map(function (changedPath) {
                            return _.keys(_eventRegistry[changedPath]);
                        })
                        .reduce(function (eventPaths1, eventPaths2) {
                            return _.union(eventPaths1, eventPaths2);
                        });

                    if (eventPaths) _emitEvent(commit, eventPaths);
                } catch (error) {
                    error.message = "error while reset [" + message + "] caused by\n" + error.message;
                    throw error;
                }
            });
        },
        path :function(pathString){
            if(_.isUndefined(pathString)) pathString = "";
            return Store(this.getId(), this, pathString, _eventEmitter);
        },
        getPath : function(path){
            const returnPath = path ? Path(_path).path(path) : Path(_path);
            if(this.isSubStore()){
                return _parentStore.getPath(returnPath);
            }
            return returnPath;
        }
    };

    if(!instance.isSubStore()){
        if(!storeId) storeId = "store" + _.keys(_storeRegistry).length;
        if(_storeRegistry[storeId]) throw new Error("there is store with same ID already.");
    }

    _storeRegistry[storeId] = instance;
    return instance;
}

export default Store;
