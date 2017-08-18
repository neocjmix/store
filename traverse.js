import _ from 'lodash';
import Path from './path';

function traverse(obj, postOrder, path){
    path = path || Path("");
    let mapValues;

    if(_.isArray(obj)){
        mapValues = _.map(obj, function(value, key){
            return traverse(value, postOrder, path.path(key))
        });
    }

    if(_.isPlainObject(obj)) {
        mapValues = _.mapValues(obj, function (value, key) {
            return traverse(value, postOrder, path.path(key));
        });
    }

    return postOrder(obj, path, mapValues);
}

export default traverse