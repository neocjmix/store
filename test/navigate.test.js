import {expect} from "chai";
import Navigate from "../navigate";
import Path from "../path";

describe("Navigate는", function() {
    it("full path로 obj를 탐색한다", function () {
        expect(Navigate({a:{b:{c:1}}}).path("a.b.c").get()).to.equal(1);
    });

    it("path 객체로 obj를 탐색한다", function () {
        expect(Navigate({a:{b:{c:1}}}).path(Path("a.b.c")).get()).to.equal(1);
        expect(Navigate({a:{b:{c:1}}}).path(Path("a").path("b").path("c")).get()).to.equal(1);
    });

    it("path chaining으로 obj를 탐색한다", function () {
        expect(Navigate({a:{b:{c:1}}}).path("a").path("b").path("c").get()).to.equal(1);
    });

    it("존재하지 않는 path는 undefined를 리턴한다", function () {
        expect(Navigate({}).path("a").path("b").path("c").get()).to.equal(undefined);
        expect(Navigate({a:1}).path("a").path("b").path("c").get()).to.equal(undefined);
        expect(Navigate({a:null}).path("a").path("b").path("c").get()).to.equal(undefined);
        expect(Navigate({a:undefined}).path("a").path("b").path("c").get()).to.equal(undefined);
    });

    it("탐색한 멤버를 바꿔치고 변경된 전체obj를 리턴한다", function () {
        let testData = {a:{b:{c:1}}};
        let changed = Navigate(testData).path("a.b.c").set(2);
        expect(changed).to.be.deep.equal({a:{b:{c:2}}});
        expect(testData.a.b.c).to.equal(2);
        expect(changed).to.equal(testData);
    });

    it("set할때 없는 경로는 만들어서 set 한다", function () {
        let testData = {a:{b:{c:1}}};
        Navigate(testData).path("a.b.c1.d2").set(3);
        expect(testData.a.b.c1.d2).to.equal(3);
        expect(testData).to.deep.equal({a:{b:{c:1,c1:{d2:3}}}});
    });
});