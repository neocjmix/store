import 'babel-polyfill'
import chai from "chai"
import _ from "lodash"
import Store from "../src/store"

const expect = chai.expect;

describe("Store는", function () {

    const testData = {
        foo:{
            bar : "baz",
            bar2 : "baz2"
        }
    };

    it("subscribe할수있다", function (done) {
        Store("", {a: 1})
            .subscribe("a")
            .then(a => {
                expect(a).to.equal(1);
                done();
            });
    });

    it("navigator path를 통해 하위요소를 구독 할 수 있다", function (done) {
        Store("", testData)
            .subscribe("foo.bar")
            .then(baz => {
                expect(baz).to.equal("baz");
                done();
            });
    });

    it("여러개의 navigator path를 통해 하위요소들을 구독 할 수 있다", function (done) {
        Store("", testData)
            .subscribe("foo.bar", "foo.bar2", "foo.bar3")
            .then((bar, bar2, bar3) => {
                expect(bar).to.equal("baz");
                expect(bar2).to.equal("baz2");
                expect(bar3).to.equal(undefined);  //없는 항목은 undefined
                done();
            });
    });

    it("update시 subscribe한 callback의 parameter에 변경된 값을 전달한다", function (done) {
        const store = Store("", {
            foo:{
                bar : "baz",
                bar2 : "baz2"
            }
        });

        store
            .subscribe("foo.bar")
            .silent()
            .then(bar => {
                expect(bar).to.equal(1000);
                done();
            });

        store.commit("", {
            foo : {
                bar : 1000
            }
        })
    });

    it("객체인 노드를 원시타입으로 덮어쓸 수 있다", function (done) {
        const store = Store("", {
            foo:{
                bar : "baz",
                bar2 : "baz2"
            }
        });

        store
            .subscribe("foo.bar", "foo")
            .silent()
            .then((bar, foo) => {
                expect(bar).to.equal(undefined);
                expect(foo).to.equal(false);
                done();
            });

        store.commit("", {
            foo : false
        })
    });

    it("undefined를 지정해서 property를 삭제할 수 있다", function (done) {
        const store = Store("", {
            foo:{
                bar : "baz",
                bar2 : "baz2"
            }
        });

        store
            .subscribe("foo.bar", "foo")
            .silent()
            .then((bar, foo) => {
                expect(bar).to.equal(undefined);
                expect(foo).to.equal(undefined);
                done();
            });

        store.commit("", {
            foo : undefined
        })
    });

    it("update하며 새로운 값을 추가할 수 있다", function (done) {
        const singleSourceOfTruth = Store("", testData);

        singleSourceOfTruth
            .subscribe("foo.bar3.baz")
            .silent()
            .then(baz => {
                expect(baz).to.equal("good");
                done();
            });

        singleSourceOfTruth.commit("", {
            foo : {
                bar3: {
                    baz : "good"
                }
            }
        })
    });

    it("array에 새로운 값을 추가 할 수 있다", function () {
        const store = Store("", {
            a: []
        });

        store
            .subscribe("a")
            .silent()
            .then(a => {
                expect(a).to.deep.equal([1]);
            });

        store.path("a[0]").commit("test commit", 1);
    });

    it("array element object에 새로운 patch를 커밋할 수 있다", function () {
        const store = Store("", {
            a: [{foo:"foo"}]
        });

        store
            .subscribe("a")
            .silent()
            .then(a => {
                expect(a).to.deep.equal([{foo:"foo",bar:"bar"}]);
            });

        store.path("a[0]").commit("test commit", {bar:"bar"});
    });

    it("array element object를 reset할수 있다", function () {
        const store = Store("", {
            a: [{foo:"foo"}]
        });

        store
            .subscribe("a")
            .silent()
            .then(a => {
                expect(a).to.deep.equal([{bar:"bar"}]);
            });

        store.path("a[0]").reset("test commit", {bar:"bar"});
    });

    it("여러개의 값을 subscribe하더라도 update가 한번 이루어지면 callback도 한번 실행된다", function (done) {
        const testData = {
            foo:{
                bar : "baz",
                bar2 : "baz2",
                bar3: {
                    baz : "good"
                }
            }
        };

        const singleSourceOfTruth = Store("", testData);

        singleSourceOfTruth
            .subscribe("foo.bar", "foo.bar2", "foo.bar3.baz", "foo.bar4.bam.boom")
            .silent()
            .then((bar, bar2, baz, boom) => {
                expect(bar).to.equal(1000);
                expect(bar2).to.equal(2000);
                expect(baz).to.equal("good");
                expect(boom).to.equal(false);
                done();
            });

        singleSourceOfTruth.commit("", {
            foo : {
                bar : 1000,
                bar2: 2000,
                bar4 : {
                    bam : {
                        boom : false
                    }
                }
            }
        });
    });

    it("event 발생을 안한채로", function () {
        const store = Store("", { foo : 1});
        let done = false;

        store
            .subscribe("foo")
            .then(foo => {
                store.commit("", {
                    bar : 1
                });
            });

        store
            .subscribe("bar")
            .then(function(bar){
                expect(bar).to.be.equal(1);
            });
    });

    it("update하는 값이 기존 값과 같으면 callback을 실행하지 않는다", function () {
        let done = 0;
        const testData = {
            foo:{
                bar : "baz",
                bar2 : "baz2",
                bar3: {
                    baz : "good"
                }
            }
        };

        const store = Store("", testData);

        store
            .subscribe("")
            .silent()
            .then(() => done++);

        store
            .subscribe("foo")
            .silent()
            .then(() => done++);

        store
            .subscribe("foo.bar")
            .silent()
            .then(() => done++);

        store
            .subscribe("foo.bar3.baz")
            .silent()
            .then(() => done++);

        store.commit("", {
            foo : {
                bar : "baz",
                bar2 : "baz2",
                bar3: {
                    baz : "good"
                }
            }
        });

        expect(done).to.equal(0);
    });


    it("update시 commit message를 전달할 수 있다", function () {
        const testData = {
            foo:{
                bar : "baz",
                bar2 : "baz2",
                bar3: {
                    baz : "good"
                }
            }
        };

        const store = Store("", testData);
        store
            .subscribe("foo.bar2")
            .silent()
            .then(function(foobar2, commit){
                expect(commit.message).to.equal("testUpdate");
            });

        store.path("foo.bar2").commit("testUpdate", 10);
    });

    it("reset을 하면 patch를 하지 않고 전체를 replace 한다.(값을 삭제할 수있다)", function () {
        const testData = {
            foo:{
                bar : "baz",
                bar2 : "baz2",
                bar3: {
                    baz : "good"
                }
            }
        };

        const store = Store("", testData);

        const pr1 = new Promise(function(resolve, reject){
            store
                .subscribe("")
                .silent()
                .then(function(state){
                    expect(state).to.deep.equal({
                        foo:{
                            bar : "baz",
                            bar2 : 0
                        }
                    });
                    resolve();
                });
        });

        const pr2 = new Promise(function(resolve, reject){
            store
                .subscribe("foo.bar3")
                .silent()
                .then(function(bar3){
                    expect(bar3).to.be.undefined;
                    resolve();
                });
        });

        const pr4 = new Promise(function(resolve, reject){
            store
                .subscribe("foo.bar3.baz")
                .silent()
                .then(function(baz){
                    expect(baz).to.be.undefined;
                    resolve();
                });
        });

        const pr5 = new Promise(function(resolve, reject){
            store
                .subscribe("foo.bar2")
                .silent()
                .then(function(bar2){
                    expect(bar2).to.equal(0);
                    resolve();
                });
        });

        let resolve2;
        const pr3 = new Promise(function(resolve, reject) {
            resolve2 = resolve;
            store
                .subscribe("foo.bar")
                .silent()
                .then(function (bar) {
                    reject();
                });
        });

        store.path("foo").reset("testUpdate", {
            bar : "baz",
            bar2 : 0
        });

        resolve2();

        return Promise.all([pr1, pr2, pr3]);
    });

    it("reset case 테스트1", function (done) {
        const store = Store("", {
            foo : "bar",
            foo2 : "bar2"
        });
        store.reset("testUpdate", {});
        store.subscribe("", "foo", "foo2")
            .then((root, foo, foo2)=>{
                expect(root).to.deep.equal({});
                expect(foo).to.be.undefined;
                expect(foo2).to.be.undefined;
                done()
            });
    });

    it("reset case 테스트2", function (done) {
        const store = Store("", {
            bab : {
                baz : {
                    foo : "bar",
                    foo2 : "bar2"
                },
                baz2 : "baz2"
            }
        });

        store.path("bab").path("baz").reset("testUpdate", {});
        store.subscribe("", "bab.baz", "bab.baz.foo", "bab.baz.foo2", "bab.baz2")
            .then((root, baz, foo, foo2, baz2)=>{
                expect(root).to.deep.equal({bab:{baz:{}, baz2 : "baz2"}});
                expect(baz).to.deep.equal({});
                expect(foo).to.be.undefined;
                expect(foo2).to.be.undefined;
                expect(baz2).to.be.equal("baz2");
                done()
            });
    });

    it("reset case 테스트3", function (done) {
        const store = Store("", {
            foo : {}
        });

        store.path("foo").reset("testUpdate", {a:1, b:2});
        store.subscribe("", "foo", "foo.a", "foo.b")
            .then((root, foo, a, b)=>{
                expect(root).to.deep.equal({foo:{a:1, b:2}});
                expect(foo).to.deep.equal({a:1, b:2});
                expect(a).to.be.equal(1);
                expect(b).to.be.equal(2);
                done()
            });
    });

    it("reset case 테스트3", function (done) {
        const store = Store("", {
            foo : {}
        });

        store.reset("testUpdate", {a:1, b:2});
        store.subscribe("", "foo", "a", "b")
            .then((root, foo, a, b)=>{
                expect(root).to.deep.equal({a:1, b:2});
                expect(foo).to.deep.equal(undefined);
                expect(a).to.be.equal(1);
                expect(b).to.be.equal(2);
                done()
            });
    });

    it("reset case 테스트4", function (done) {
        const store = Store("", {
            foo : {}
        });

        store.path("bar").reset("testUpdate", {a:1, b:2});
        store.subscribe("", "foo", "bar", "bar.a", "bar.b")
            .then((root, foo, bar, a, b)=>{
                expect(root).to.deep.equal({foo:{}, bar : {a:1, b:2}});
                expect(foo).to.deep.equal({});
                expect(bar).to.deep.equal({a:1, b:2});
                expect(a).to.be.equal(1);
                expect(b).to.be.equal(2);
                done()
            });
    });

    it("reset 후에도 이전 객체를 변경하지 않는다", function (done) {
        const store = Store("", {foo : {bar :{a:1,b:2}}});
        const states = [];

        store
            .subscribe("")
            .then(function(state){
                states.push(state);
            });

        store
            .path("foo")
            .path("bar")
            .reset("", {});

        _.defer(function(){
            expect(states).to.deep.equal([
                {foo : {bar :{a:1,b:2}}},
                {foo : {bar :{}}}
            ]);
            done();
        })
    });

    it("commit한 object가 변경되어도 state가 변하지 않는다(복사본이다)", function () {
        const result = [];
        const store = Store("", {});
        store
            .subscribe("")
            .then(function(state){
                result.push(state);
            });

        let temp = {
            a:1
        };
        store.commit("testUpdate", temp);
        temp.a = 2;
        store.commit("testUpdate", temp);
        temp.b = 4;
        store.commit("testUpdate", temp);
        temp.a = [];
        temp.c = "a";
        store.commit("testUpdate", temp);
        store.commit("testUpdate", temp);
        store.commit("testUpdate", temp);
        temp.a.push(1);
        store.commit("testUpdate", temp);
        temp.b = undefined;
        temp.c = 1;
        store.reset("testUpdate", temp);
        store.reset("testUpdate", temp);
        delete temp.a;
        store.reset("testUpdate", temp);
        store.reset("testUpdate", temp);
        store.reset("testUpdate", temp);
        expect(result).to.be.deep.equal([
            {},
            {a:1},
            {a:2},
            {a:2,b:4},
            {a:[],b:4,c:"a"},
            {a:[1],b:4,c:"a"},
            {a:[1],c:1},
            {c:1}
        ])
    });


    it("commit 간의 전파 관계를 추적할 수 있다", function (done) {
        const store = Store("", {});
        let originalCommit;

        store
            .subscribe("a")
            .silent()
            .then(function(a, commit){
                originalCommit = commit;
                store.commit("propagated commit", {
                    b : a
                });
            });

        store
            .subscribe("b")
            .silent()
            .then(function(b, commit){
                expect(b).to.be.equal(1);
                expect(commit.origin).to.be.equal(originalCommit);
                done();
            });

        store.commit("original commit", {
            a : 1
        });
    });

    it("commit 간의 전파 관계를 추적할 수 없다(subscribe async)", function (done) {
        const store = Store("", {});
        let originalCommit;

        store
            .subscribe("a")
            .silent()
            .async()
            .then(function(a, commit){
                originalCommit = commit;
                store.commit("propagated commit", {
                    b : a
                });
            });

        store
            .subscribe("b")
            .silent()
            .async()
            .then(function(b, commit){
                expect(b).to.be.equal(1);
                expect(commit.origin).to.be.not.equal(originalCommit);
                done();
            });

        store.commit("original commit", {
            a : 1
        });
    });


    it("하위 객체가 업데이트 되면 이에 따라 변경된 상위 객체에 대해서도 event가 발생한다", function (done) {
        const testData = {
            foo:{
                bar : "baz",
                bar2 : {
                    baz : {
                        a: 1,
                        b: 2,
                        c: [10,20,30]
                    }
                }
            }
        };

        let store = Store("", testData);

        store
            .subscribe("foo")
            .silent()
            .then(function(foo){
                expect(foo).to.deep.equal({
                    bar : "baz",
                    bar2 : {
                        baz : {
                            a: 3,
                            b: 2,
                            c: [10,20,30]
                        }
                    }
                });
                done();
            });

        store.commit("", {
            foo:{
                bar2 : {
                    baz : {
                        a: 3
                    }
                }
            }
        });
    });

    it("commit은 기본적으로 동기적으로 처리된다", function () {
        const result = [];
        const store = Store("", {});
        store
            .subscribe("a")
            .silent()
            .then(function(a){
                store.commit("testUpdate", {
                    a:2
                });

                result.push(a);
            });

        store.commit("testUpdate", {
            a:1
        });

        result.push(0);
        expect(result).to.deep.equal([2,1,0]);
    });

    it("callback을 비동기적으로 처리할 수도 있다", function (done) {
        const result = [];
        const store = Store("", {});
        store
            .subscribe("a")
            .silent()
            .async()
            .then(function(a){
                store.commit("testUpdate", {
                    a:2
                });

                result.push(a);
                if(result.length > 2){
                    expect(result).to.deep.equal([0,1,2]);
                    done();
                }
            });

        store.commit("testUpdate", {
            a:1
        });

        result.push(0);
    });

    describe("하위구조에 대해서 작동하는 sub-store를", function () {
        const testData = {
            foo:{
                bar : "baz",
                bar2 : {
                    baz : {
                        a: 1,
                        b: 2,
                        c: [10,20,30]
                    }
                }
            }
        };

        it("path(\"...\")를 통해 생성한다", function () {
            expect(Store("", testData).path("bar2.baz")).to.be.ok;
            expect(Store("", testData).path("bar2").path("baz")).to.be.ok;
        });

        it("구독 할수있다", function (done) {
            Store("", testData).path("foo.bar2.baz")
                .subscribe("a", "c[1]")
                .then(function(a, c1){
                    expect(a).to.equal(1);
                    expect(c1).to.equal(20);
                    done();
                });
        });

        it("업데이트 할수있다", function (done) {
            let subStore = Store("", testData).path("foo.bar2.baz");

            subStore
                .subscribe("a", "c", "d")
                .silent()
                .then(function(a, c, d){
                    expect(a).to.equal(3);
                    expect(c).to.deep.equal([10,20,33,40]);
                    expect(d).to.equal("!");
                    done();
                });

            subStore.commit("", {
                a:3,
                c:[10,20,33,40],
                d:"!"
            })
        });

        it("업데이트 하면 상위 store 대해서도 업데이트가 일어난다", function () {
            const testData = {
                foo:{
                    bar : "baz",
                    bar2 : {
                        baz : {
                            a: 1,
                            b: 2,
                            c: [10,20,30]
                        }
                    }
                }
            };

            let store = Store("", testData);
            let subStore = store.path("foo.bar2.baz");

            const subUpdate = new Promise(function(resolve, reject) {
                subStore
                    .subscribe("a", "c", "d")
                    .silent()
                    .then(function(a, c, d){
                        expect(a).to.equal(6);
                        expect(c).to.deep.equal([100,34,234,56]);
                        expect(d).to.equal("___");
                        resolve();
                    });
            });

            const mainUpdate = new Promise(function(resolve, reject) {
                store
                    .subscribe("")
                    .silent()
                    .then(function (root) {
                        expect(root).to.deep.equal({
                            foo: {
                                bar: "baz",
                                bar2: {
                                    baz: {
                                        a: 6,
                                        b: 2,
                                        c: [100, 34, 234, 56],
                                        d: "___"
                                    }
                                }
                            }
                        });
                        resolve();
                    });
            });

            const mainUpdate2 = new Promise(function(resolve, reject) {
                store
                    .subscribe("foo")
                    .silent()
                    .then(function (root) {
                        expect(root).to.deep.equal({
                            bar: "baz",
                            bar2: {
                                baz: {
                                    a: 6,
                                    b: 2,
                                    c: [100, 34, 234, 56],
                                    d: "___"
                                }
                            }
                        });
                        resolve();
                    });
            });

            subStore.commit("", {
                a:6,
                c:[100,34,234,56],
                d:"___"
            });

            return Promise.all([subUpdate, mainUpdate, mainUpdate2]);
        });

        it("subpath 도 subpath를 생성하고 업데이트 할수있다", function (done) {
            let store = Store("", {
                foo:{
                    bar : "baz",
                    bar2 : {
                        baz : {
                            a: 1,
                            b: 2,
                            c: [10,20,30]
                        }
                    }
                }
            });
            let subStore = store.path("foo").path("bar2").path("baz");

            store
                .path("foo")
                .subscribe("bar2.baz.a", "bar2.baz.c", "bar2.baz.d")
                .silent()
                .then(function(a, c, d){
                    expect(a).to.equal(3);
                    expect(c).to.deep.equal([10,20,33,40]);
                    expect(d).to.equal("!");
                    done();
                });

            subStore.commit("", {
                a:3,
                c:[10,20,33,40],
                d:"!"
            })
        });
    });
});