import chai from "chai";
import path from "../src/path";

const expect = chai.expect;

describe("path", function () {
    describe("create", function () {
        it("생성후 string으로 비교할수있다", function () {
            const testPath = path("a");
            expect(testPath.toString()).to.equal("a");
        });

        it("fullpath로 hirarchy를 한번에 생성할 수 있다", function () {
            const d = path("a.b[0].ab");
            const c = d.getParent();
            const b = c.getParent();

            expect(d.toString()).to.equal("a.b[0].ab");
            expect(c.toString()).to.equal("a.b[0]");
            expect(b.toString()).to.equal("a.b");
        });

        it("chaining으로 생성할수 있다", function () {
            expect(path("a").path("b").path(0).path("ab").toString()).to.equal("a.b[0].ab");
            expect(path("a").path("b[0]").path(0).path("ab.c.a").toString()).to.equal("a.b[0][0].ab.c.a");
        });

        it("chaining에 parameter를 지정하지 않거나 \"\"를 지정하면 현재 path를 나타낸다", function () {
            expect(path("a").path("b").path().path().path().path(0).path("ab").toString()).to.equal("a.b[0].ab");
            expect(path("a").path("b").path("").path("").path("").path(0).path("ab").toString()).to.equal("a.b[0].ab");
        });

        it("chaining으로 생성할때 원본을 변화시키지 않는다", function () {
            const a = path("a");
            const b = a.path("b");
            const c = b.path(0);
            const d = c.path("ab");
            expect(a.toString()).to.equal("a");
            expect(b.toString()).to.equal("a.b");
            expect(c.toString()).to.equal("a.b[0]");
            expect(d.toString()).to.equal("a.b[0].ab");

            expect(a.toString()).to.not.equal(b);
            expect(b.toString()).to.not.equal(c);
            expect(c.toString()).to.not.equal(d);
        });

        it("path객체로 생성하면 그대로 반환된다", function(){
            const a = path("a.b[0].ab");
            expect(path(a)).to.equal(a);
        });

        it("chaining에 path객체를넣을 수 있다", function () {
            expect(path("a").path(path("b")).toString()).to.equal("a.b");
        });

        it("여러 case의 key name 에서 정상적으로 작동한다", function () {
            expect(path("a.b.c").toString()).to.equal("a.b.c");
            expect(path("a.b1[0].c").toString()).to.equal("a.b1[0].c");
            expect(path("a.b2[0][0].1c").toString()).to.equal("a.b2[0][0].1c");
        });

        it("parent path를 반환할 수 있다", function () {
            const a = path("a");
            const b = a.path("b");
            const c = b.path(0);
            const d = c.path("ab");
            expect(b.getParent().toString()).to.equal("a");
            expect(c.getParent().toString()).to.equal("a.b");
            expect(d.getParent().toString()).to.equal("a.b[0]");
            expect(b.getParent()).to.equal(a);
            expect(c.getParent()).to.equal(b);
            expect(d.getParent()).to.equal(c);
        });

        it("path를 순서대로 array로 리턴한다", function () {
            expect(path("a.b[0].ab").toArray()).to.deep.equal(["a","b","0","ab"]);
        });

        it("한path가 다른 path의 하위path 인지를 확인 할 수 있다", function () {
            expect(path("a.b").contains("a.b.c")).to.be.equal(true);
            expect(path("a.b").contains(path("a.b.c"))).to.be.equal(true);
            expect(path("a.b").contains(path("a.b"))).to.be.equal(false);
            expect(path("a.b").contains(path("a").path("b"))).to.be.equal(false);
            expect(path("a.b").contains(path("a"))).to.be.equal(false);
        });


    });

    describe("rootPath",function(){
        it("1depth일 경우 getParent()는 rootPath를 리턴한다", function(){
            let rootPath = path("a").getParent();
            expect(rootPath.toString()).to.equal("");
            expect(rootPath.isRoot()).to.be.true;
        });

        it("parameter 없이, 또는 \"\"으로 초기화하면 rootPath를 리턴한다", function() {
            expect(path().isRoot()).to.be.true;
            expect(path("").isRoot()).to.be.true;
            expect(path().path().isRoot()).to.be.true;
            expect(path().path().path("").isRoot()).to.be.true;
        });

        it("rootPath.toString은 \"\"이다", function() {
            expect(path().toString()).to.equal("");
        });

        it("rootPath의 parent는 rootPath이다", function() {
            let rootPath = path();
            expect(rootPath.getParent()).to.equal(rootPath);
        });
    });
});