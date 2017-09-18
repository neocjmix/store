import _ from 'lodash';
import Path from './path';

function traverse(obj, callback, options, path){
    path = path || Path("");
    options = _.assign({
        array : false,
        preOrder : false
    }, options);



    if(options.preOrder) callback(obj, path);

    let mapValues;
    if(options.array && _.isArray(obj)){
        mapValues = _.map(obj, function(value, key){
            return traverse(value, callback, options, path.path(key))
        });
    }

    if(_.isPlainObject(obj)) {
        mapValues = _.mapValues(obj, function (value, key) {
            return traverse(value, callback, options, path.path(key));
        });
    }

    if(!options.preOrder) return callback(obj, path, mapValues);
}

export default traverse