import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import Path from './path'
import Navigate from './navigate'
import traverse from './traverse'
import Queue from './queue'

const noChange = new (function NoChange(){})();
const deleted = new (function Deleted(){})();
const _storeRegistry = {};

function _shouldChanged(value){
    return value !== noChange;
}

function _shouldDeleted(value){
    return value === deleted
}

function _Thenable(eventEmitter, eventName, immediateValues) {
    return {
        then : function(callback){
            eventEmitter.on(eventName, function (message, patch) {
                callback.apply({
                    message: message,
                    patch: patch
                }, [].slice.call(arguments, 2));
            });

            if (immediateValues) {
                callback.apply({
                    message: "subscribing [" + eventName + "]",
                    patch: undefined //TODO
                }, immediateValues);
            }
        },
        silent : function(){
            return _Thenable(eventEmitter, eventName);
        }
    }
}

function _emitEvent(state, eventEmitter, message, patch, eventPaths) {
    _(eventPaths).forEach(function (eventPath) {
        const eventArguments = _(eventPath.split(","))
            .map(function (path) {
                return Navigate(state).path(path).get();
            }).value();

        _.defer(function(){
            eventEmitter.emit.apply(eventEmitter, [eventPath, message, patch].concat(eventArguments));
        });
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
        if (oldValue === newValue) return noChange;

        if (!_.isUndefined(oldValue) && _.isUndefined(newValue)) {
            changedPaths.push(currentPath);
            return deleted;
        }

        if (_.isPlainObject(newValue) && !_.isEmpty(newValue) && _.isEmpty(changedChildValues)) return noChange;

        //기존 값이 객체일때는 childValues를 적용
        if (_.isPlainObject(oldValue) && (!_.isEmpty(changedChildValues) || !_.isEmpty(deletedChildValues))){
            //추가
            newValue = _.assign({}, oldValue, changedChildValues);
            //삭제
            _.forEach(_.keys(deletedChildValues), function(key){
                delete newValue[key]
            })
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
        if(basePath && !basePath.contains(currentPath) && !currentPath.contains(basePath) && currentPath+"" !== basePath+"") {
            return noChange;
        }

        const changedChildValues = _.pick(childValues, _shouldChanged);
        const deletedChildValues = _.pick(childValues, _shouldDeleted);
        let newValue = Navigate(patch).path(currentPath).get();

        if(oldValue === newValue) return noChange;
        if(_.isUndefined(newValue)){
            changedPaths.push(currentPath);
            return deleted;
        }

        if (_.isPlainObject(oldValue) && _.isPlainObject(newValue)){
            newValue = _.assign({}, oldValue, newValue);

            if(!_.isEmpty(changedChildValues)){
                newValue = _.assign(newValue, changedChildValues);
            }

            if(!_.isEmpty(deletedChildValues)){
                _.forEach(_.keys(deletedChildValues), function(key){
                    delete newValue[key];
                })
            }
        }

        changedPaths.push(currentPath);
        return newValue;
    }, true);

    return {
        changedPaths :  changedPaths,
        state : newState
    };
}

function _applyCommits(queue, state, eventEmitter){

    const eventData = queue.dequeueAll();
    const messages = _(eventData)
        .pluck("message")
        .uniq()
        .value()
        .join(",\n");
    const paths = _(eventData)
        .pluck("eventPaths")
        .flatten()
        .uniq()
        .value();

    const patch = _(paths).reduce(function(patched, path){
        if(path !== "") Navigate(patched).path(path).set(Navigate(state).path(path).get());
        return patched;
    }, {});

    _emitEvent(state, eventEmitter, messages, patch, paths);
}

function Store(storeId, initState, pathString, eventEmitter){
    let _state = initState || {};
    let _paused = false;
    const _queue = Queue();
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
            return _Thenable(_eventEmitter, eventName, paths.map(path => Navigate(_state).path(path).get()));
        },
        commit : function(message, patch){
            if(!_.isString(message)) throw new TypeError("missing commit message");
            // if(_.isUndefined(patch)) patch = {};

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

                if(!eventPaths) return;

                if(_paused){
                    _queue.enqueue({
                        message : message,
                        eventPaths : eventPaths
                    });
                }else{
                    _emitEvent(_state, _eventEmitter, message, patch, eventPaths);
                }
            }catch (error){
                error.message = "error while commit ["+ message +"] caused by\n" + error.message;
                throw error;
            }
        },
        reset : function(message, patch, basePath){
            if (this.isSubStore()) {
                const pathedPatch = _path.toString() === "" ? patch : Navigate({}).path(_path).set(patch);
                return _parentStore.reset(message, pathedPatch, _path.path(basePath || ""));
            }
            try{
                const result = _replace(_state, patch, basePath);
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

                if(!eventPaths) return;

                if(_paused){
                    _queue.enqueue({
                        message : message,
                        eventPaths : eventPaths
                    });
                }else{
                    _emitEvent(_state, _eventEmitter, message, patch, eventPaths);
                }
            }catch (error){
                error.message = "error while reset ["+ message +"] caused by\n" + error.message;
                throw error;
            }
        },
        path :function(pathString){
            if(_.isUndefined(pathString)) pathString = "";
            return Store(this.getId(), this, pathString, _eventEmitter);
        },
        pause : function(){
            _paused = true;
            return {
                length : function(){
                    return _queue.length();
                },
                resume : function(){
                    _paused = false;
                    _applyCommits(_queue, _state, _eventEmitter);
                }
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
