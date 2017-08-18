import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import Path from './path'
import Navigate from './navigate'
import traverse from './traverse'

const noChange = {
    toString : function(){
        return "nothing is Changed";
    }
};

const _storeRegistry = {};

function _isChanged(value){
    return value !== noChange
}

function _Thenable(eventEmitter, eventName, immediateValues) {
    return {
        then : function(callback){
            eventEmitter.on(eventName, function(){
                callback.apply({
                    message : arguments[0]
                }, [].slice.call(arguments,1))
            });
            if (immediateValues){
                eventEmitter.emit.apply(
                    eventEmitter,
                    [eventName, "subscribing [" + eventName + "]"].concat(immediateValues));
            }
        },
        silently : function(){
            return _Thenable(eventEmitter, eventName);
        }
    }
}

function _emitEvent(state, eventEmitter, message, eventPaths) {
    _(eventPaths).forEach(function (eventPath) {
        const eventArguments = _(eventPath.split(","))
            .map(function (path) {
                return Navigate(state).path(path).get();
            }).value();

        eventEmitter.emit.apply(eventEmitter, [eventPath, message].concat(eventArguments));
    }).value();
}

function _applyPatch(state, patch) {
    const currentPaths = [];
    const newState = traverse(patch, function (newValue, currentPath, childValues) {
        const changedChildValues = _.pick(childValues, _isChanged);
        const currentProperty = Navigate(state).path(currentPath);
        const oldValue = currentProperty.get();

        //값 변화 없을 시 리턴
        if (oldValue === newValue) return noChange;
        if (_.isPlainObject(oldValue) && _.isEmpty(changedChildValues)) return noChange;

        //기존 값이 객체이거나 새로운 값을 추가할때는 새로운 값 객체를 생성해서 할당
        if (_.isPlainObject(oldValue)) newValue = _.assign({}, oldValue, changedChildValues);

        //이벤트 발생시킬 path 추가
        currentPaths.push(currentPath);
        return newValue;
    });

    return {
        changedPaths :  currentPaths,
        state : newState
    };
}

function _replace(state, patch) {
    const currentPaths = [];
    const newState = traverse(state, function (oldValue, currentPath, childValues) {
        const changedChildValues = _.pick(childValues, _isChanged);
        const currentProperty = Navigate(state).path(currentPath);

        let newValue = Navigate(patch).path(currentPath).get();

        if (_.isUndefined(newValue)) {
            currentPaths.push(currentPath);
            return noChange;
        }
        if (_.isPlainObject(oldValue) && _.isEmpty(changedChildValues)){
            currentPaths.push(currentPath);
            return noChange;
        }

        if (_.isPlainObject(oldValue)) newValue = _.assign({}, changedChildValues);

        if(oldValue === newValue){
        }else{
            currentPaths.push(currentPath);
        }
        return newValue;
    });

    return {
        changedPaths :  currentPaths,
        state : newState
    };
}

function _registerEvents(eventStorage, eventPaths) {
    const eventName = eventPaths.join(",");
    eventPaths.forEach(function (path) {
        eventStorage[path] = eventStorage[path] || {};
        eventStorage[path][eventName] = eventStorage[path][eventName] + 1 || 1;
    });
    return eventName;
}

function Store(storeId, initState, pathString, eventEmitter){
    let _state = initState || {};
    const _path = _.isUndefined(pathString) ? undefined : Path(pathString);
    const _parentStore = _.isFunction(initState.subscribe) && _.isFunction(initState.commit) ? initState : undefined;
    const _eventEmitter = eventEmitter || new EventEmitter();
    const _events = {};
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

            const eventName = _registerEvents(_events, paths);
            return _Thenable(_eventEmitter, eventName, paths.map(path => Navigate(_state).path(path).get()));
        },
        commit : function(message, patch){
            if(this.isSubStore()) {
                return _parentStore.commit(message, Navigate({}).path(_path).set(patch));
            }

            try{
                const result = _applyPatch(_state, patch, _events);
                if(_isChanged(result.state)) _state = result.state;

                let eventPaths = _(result.changedPaths)
                    .filter(function(changedPath) {
                        return _events[changedPath];
                    })
                    .map(function(changedPath){
                        return _.keys(_events[changedPath]);
                    })
                    .reduce(function(eventPaths1, eventPaths2){
                        return _.union(eventPaths1, eventPaths2);
                    });

                _emitEvent(_state, _eventEmitter, message, eventPaths);
            }catch (error){
                error.message = "error while commit ["+ message +"] caused by\n" + error.message
                throw error;
            }
        },
        reset : function(message, patch){
            if(this.isSubStore()) {
                return _parentStore.reset(message, Navigate({}).path(_path).set(patch));
            }

            try{
                const result = _replace(_state, patch, _events);

                if(_isChanged(result.state)) _state = result.state;


                let eventPaths = _(result.changedPaths)
                    .filter(function(changedPath) {
                        return _events[changedPath];
                    })
                    .map(function(changedPath){
                        return _.keys(_events[changedPath]);
                    })
                    .reduce(function(eventPaths1, eventPaths2){
                        return _.union(eventPaths1, eventPaths2);
                    });

                _emitEvent(_state, _eventEmitter, message, eventPaths);
            }catch (error){
                error.message = "error while commit ["+ message +"] caused by\n" + error.message
                throw error;
            }

        },
        path :function(pathString){
            return Store(this.getId(), this, pathString, _eventEmitter);
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
