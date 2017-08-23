import Queue from '../src/queue'
import chai from "chai";

const expect = chai.expect;

describe("Queue는", ()=>{
    it("초기화할 수 있다", () => {
        expect(Queue()).to.be.ok
    });

    it("enqueue 한 순서대로 dequeue 된다", () => {
        const queue = Queue();
        queue.enqueue(1).enqueue(2).enqueue(3);
        expect(queue.dequeue()).to.be.equal(1);
        expect(queue.dequeue()).to.be.equal(2);
        expect(queue.dequeue()).to.be.equal(3);
    });

    it("생성시 초기화 할수있다", () => {
        const queue = Queue([1,2,3]);
        queue.enqueue("4").enqueue("5").enqueue("6");
        expect(queue.dequeue()).to.be.equal(1);
        expect(queue.dequeue()).to.be.equal(2);
        expect(queue.dequeue()).to.be.equal(3);
        expect(queue.dequeue()).to.be.equal("4");
        expect(queue.dequeue()).to.be.equal("5");
        expect(queue.dequeue()).to.be.equal("6");
    });

    it("크기를 알 수 있다", () => {
        const queue = Queue();
        queue.enqueue(1).enqueue(2).enqueue(3);
        expect(queue.length()).to.be.equal(3);
    });

    it("queue가 비어있으면 throw error", () => {
        const queue = Queue();
        expect(()=>queue.dequeue()).to.throw(RangeError);
    });

    it("남은 queue를 한번에 dequeue 할수있다", () => {
        const queue = Queue();
        const result = [];
        queue.enqueue("1").enqueue("2").enqueue("3");
        expect(queue.dequeueAll()).to.be.deep.equal(["1","2","3"]);
        queue.enqueue(4).enqueue(5).enqueue(6);
        queue.dequeueAll(function(value){
            result.push(value);
        });
        expect(result).to.deep.equal([4,5,6]);
    });
});
