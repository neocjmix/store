import _ from "lodash"

const SELF_PATH = "";

function _findFirstMatch(text, regExp) {
    if(!_.isString(text)) text = text +"";
    const match = text.match(regExp);
    return match ? match[1] : "";
}

function path(fullPath, parent){
    let _lastDepthPath;
    let _parent;

    if (_.isObject(fullPath)) return fullPath;

    if(fullPath === "" || _.isUndefined(fullPath)){
        if(parent) return parent;
        _lastDepthPath = SELF_PATH;
    }else{
        _lastDepthPath = _findFirstMatch(fullPath, /([^\.\[\]]*)\]?$/);
        _parent = path(_findFirstMatch(fullPath, /(.*)(\.|\[)[^\.\[\]]*\]?$/), parent);
    }

    return {
        toString : function(){
            const currentPathToString = _lastDepthPath;

            if(this.isRoot())
                return "";
            if(this.getParent().isRoot())
                return currentPathToString;
            if(currentPathToString === "")
                return this.getParent() + currentPathToString;
            if(isNaN(currentPathToString))
                return this.getParent() + "." + currentPathToString;
            else
                return this.getParent() + "[" + currentPathToString + "]";
        },
        isRoot : function(){
            return _lastDepthPath === SELF_PATH && this.getParent() === this
        },
        getParent : function(){
            return _.isUndefined(_parent) ? this : _parent;
        },
        toArray : function(){
            const currentPath = _lastDepthPath === SELF_PATH ? [] : [_lastDepthPath];
            return this.isRoot() ? [] : this.getParent().toArray().concat(currentPath);
        },
        path : function(nextPath){
            return path(nextPath, this)
        }
    }
}

export default path