import _ from 'lodash'
import Path from "./path"

function _Property(obj, currentPath){
    let _path = Path(currentPath);

    return _.assign(_path, {
        path : function(subPath){
            return _Property(obj, Path(subPath, this))
        },
        get : function(){
            return this.toArray().reduce(function(target, path){
                if(!_.isPlainObject(target) && !_.isArray(target)) return undefined;
                return target[path];
            }, obj);
        },
        set : function(newValue){
            if(this.toString() === "") throw new RangeError("cannot set on object root path");
            let lastTarget;
            let lastPath;

            this.toArray().reduce(function(target, path){
                lastTarget = target;
                lastPath = path;
                if(target[path] === undefined) target[path] = {};
                return target[path];

            }, obj);

            if(lastTarget && lastPath) lastTarget[lastPath] = newValue;
            return obj;
        }
    });
}

function Navigate(obj){
    return _Property(obj, "");
}

export default Navigate;