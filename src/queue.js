import _ from 'lodash'

const Queue = function(initialQueue){
    let _queue = initialQueue || [];
    let _index = 0;

    function _reset(){
        _queue = [];
        _index = 0;
    }

    return {
        enqueue : function(obj){
            _queue.push(obj);
            return this
        },
        dequeue : function(callback){
            const result = _queue[_index++];
            if(this.length() < 0) throw new RangeError("queue is empty");
            if(this.length() < 1) _reset();
            if(callback) callback(result);
            return result;
        },
        dequeueAll :function(callback){
            const result = [];
            while (this.length() > 0){
                result.push(this.dequeue(callback));
            }
            return result;
        },
        length : function(){
            return _queue.length - _index;
        },
        reset : _reset
    }
};
export default Queue