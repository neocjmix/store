import 'babel-polyfill';
import chai from "chai";
import Store from "..";

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
        const singleSourceOfTruth = Store("", testData);

        singleSourceOfTruth
            .subscribe("foo.bar")
            .silently()
            .then(bar => {
                expect(bar).to.equal(1000);
                done();
            });

        singleSourceOfTruth.commit("", {
            foo : {
                bar : 1000
            }
        })
    });

    it("update하며 새로운 값을 추가할 수 있다", function (done) {
        const singleSourceOfTruth = Store("", testData);

        singleSourceOfTruth
            .subscribe("foo.bar3.baz")
            .silently()
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
            .silently()
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
            .silently()
            .then(() => done++);

        store
            .subscribe("foo")
            .silently()
            .then(() => done++);

        store
            .subscribe("foo.bar")
            .silently()
            .then(() => done++);

        store
            .subscribe("foo.bar3.baz")
            .silently()
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
        let done = false;
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
            .silently()
            .then(function(){
                expect(this.message).to.equal("testUpdate");
            });

        store.path("foo.bar2").commit("testUpdate", 10);

        expect(done).to.equal(false);
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
                .silently()
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
                .silently()
                .then(function(bar3){
                    expect(bar3).to.be.undefined;
                    resolve();
                });
        });

        const pr4 = new Promise(function(resolve, reject){
            store
                .subscribe("foo.bar3.baz")
                .silently()
                .then(function(baz){
                    expect(baz).to.be.undefined;
                    resolve();
                });
        });

        const pr5 = new Promise(function(resolve, reject){
            store
                .subscribe("foo.bar2")
                .silently()
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
                .silently()
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
            .silently()
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
                .silently()
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
                    .silently()
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
                    .silently()
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
                    .silently()
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
                .silently()
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