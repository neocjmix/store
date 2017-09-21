import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import Path from './path'
import Navigate from './navigate'
import traverse from './traverse'
import Queue from './queue'

const noChange = new (function NoChange(){})();
const deleted = new (function Deleted(){})();
const _storeRegistry = {};
const _callbackStack = [];

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

function _Thenable(eventEmitter, eventName, immediateValues) {
    return {
        then : function(callback){
            eventEmitter.on(eventName, function () {
                const callbackArgs = arguments;
                const commit = _.last(callbackArgs);
                commit.cause = _.last(_callbackStack);
                _callbackStack.push(commit);
                callback.apply(this, callbackArgs);
                _callbackStack.pop();
            });

            if (immediateValues) {
                callback.apply(this, immediateValues);
            }
        },
        silently : function(){
            return _Thenable(eventEmitter, eventName);
        }
    }
}

function _emitEvent(state, eventEmitter, mode, message, patch, eventPaths) {
    const commit = {
        message : message,
        patch : patch,
        mode : mode,
        cause : undefined
    };

    _(eventPaths).forEach(function (eventPath) {
        const eventArguments = _.map(eventPath.split(","), function (path) {
            return Navigate(state).path(path).get();
        });

        eventEmitter.emit.apply(eventEmitter,
            [eventPath]
            .concat(eventArguments)
            .concat([commit]));
    }).value();
}

function _registerEvents(eventRegistry, eventPaths) {
    const eventName = eventPaths.join(",");
    eventPaths.forEach(function (path) {
        eventRegistry[path] = eventRegistry[path] || {};
        eventRegistry[path][eventName] = eventRegistry[path][eventName] + 1 || 1;
    });
    return eventName;
}

function _applyPatch(state, patch) {
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
            changedPaths.push(currentPath);
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

    const newState = traverse(state, function(oldValue, currentPath, childValues){
        if(basePath &&
            !basePath.contains(currentPath) &&
            !currentPath.contains(basePath) &&
            !currentPath.equals(basePath)) return noChange;


        const changedChildValues = _.pick(childValues, _shouldChanged);
        const deletedChildValues = _.pick(childValues, _shouldDeleted);
        let newValue = Navigate(patch).path(currentPath).get();

        if(_.isArray(newValue)) {
            newValue = newValue.slice();
            if (_.isArray(oldValue) && _arrayEquals(oldValue, newValue)) return noChange;
        }else if (oldValue === newValue) {
            return noChange;
        }

        if(_.isUndefined(newValue) && !_.isUndefined(oldValue)){
            changedPaths.push(currentPath);
            return deleted;
        }

        if (_.isPlainObject(oldValue) && _.isPlainObject(newValue)){
            const addedChildValues = _.pick(newValue, function(value, key){
                return !_.isUndefined(value) && _.isUndefined(oldValue[key]);
            });

            if (_.isEmpty(changedChildValues) && _.isEmpty(deletedChildValues) && _.isEmpty(addedChildValues)){
                return noChange;
            }

            newValue = _.assign({}, oldValue, changedChildValues, addedChildValues);

            if(!_.isEmpty(deletedChildValues)){
                _.forEach(_.keys(deletedChildValues), function(key){
                    delete newValue[key];
                })
            }
        }

        if(_.isArray(oldValue) && childValues){
            newValue = [].slice.apply(oldValue);
            _.forEach(childValues, function(value, key){
                newValue[key] = value;
            });
        }else if (_.isArray(newValue)){
            newValue = newValue.slice();
        }

        changedPaths.push(currentPath);
        return newValue;
    }, { array : true });


    return {
        changedPaths :  changedPaths,
        state : newState
    };
}

function Store(storeId, initState, pathString, eventEmitter){
    let _state = initState || {};
    const _path = _.isUndefined(pathString) ? "" : Path(pathString);
    const _parentStore = _.isFunction(initState.subscribe) && _.isFunction(initState.commit) ? initState : undefined;
    const _eventEmitter = eventEmitter || new EventEmitter();
    const _eventRegistry = {};
    const instance = {
        getId : function(){
            return storeId;
        },
        isSubStore: function () {
            return _parentStore && _path;
        },
        subscribe : function(...paths){
            if(this.isSubStore()) {
                return _parentStore.subscribe(...paths.map(function(path){
                    return _path.path(path).toString();
                }))
            }

            const eventName = _registerEvents(_eventRegistry, paths);
            return _Thenable(_eventEmitter, eventName, paths.map(path => Navigate(_state).path(path).get()).concat({
                message: "subscribing [" + eventName + "]",
                patch: undefined //TODO
            }));
        },
        commit : function(message, patch, slient){
            if(!_.isString(message)) {
                throw new TypeError("missing commit message");
            }

            if (this.isSubStore()) {
                const pathedPatch = _path.toString() === "" ? patch : Navigate({}).path(_path).set(patch);
                return _parentStore.commit(message, pathedPatch);
            }

            try{
                const result = _applyPatch(_state, patch);
                if(_shouldChanged(result.state)) _state = result.state;

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

                if(eventPaths && !slient) _emitEvent(_state, _eventEmitter, "commit", message, patch, eventPaths);
            }catch (error){
                error.message = "error while commit ["+ message +"] caused by\n" + error.message;
                throw error;
            }
        },
        reset : function(message, patch, basePath){
            if(!_.isString(message)) throw new TypeError("missing reset message");
            if (this.isSubStore()) {
                const pathedPatch = _path.toString() === "" ? patch : Navigate({}).path(_path).set(patch);
                return _parentStore.reset(message, pathedPatch, _path.path(basePath || ""));
            }
            try{
                const result = _replace(_state, patch, basePath);
                if(_shouldChanged(result.state)) {
                    _state = result.state;
                }
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

                if(eventPaths) _emitEvent(_state, _eventEmitter, "commit", message, patch, eventPaths);
            }catch (error){
                error.message = "error while reset ["+ message +"] caused by\n" + error.message;
                throw error;
            }
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
        },
        async :  {
            commit : function(){
                _.defer(function(args){
                    instance.commit.apply(instance,args);
                }, arguments);
            },
            reset : function(){
                _.defer(function(args){
                    instance.reset.apply(instance,args);
                }, arguments);
            }
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
