import 'babel-polyfill';
import chai from "chai";
import traverse from "../src/traverse";

const expect = chai.expect;

describe("Traverse는", function () {
    const testData = {
        a: {
            aa: {
                aaa: "aaa",
                aab: "aab"
            },
            ab: {
                aba: "aba",
                abb: "abb"
            },
            ac: [0, {ac1a: 10, ac1b: 20}, "2"]
        },
        b: {
            ba: "ba"
        }
    };

    describe("object를 순회할때", function () {
        it("callback의 첫번째 파라미터로 그 값을 넘긴다", function () {
            const results = [];

            traverse(testData, (obj) => {
                results.push(obj);
            });

            expect(results).to.deep.equal([
                "aaa", "aab",
                testData.a.aa,
                "aba", "abb",
                testData.a.ab,
                testData.a.ac,
                testData.a,
                "ba",
                testData.b,
                testData
            ]);
        });

        it("callback의 두번째 파라미터로 path를 넘긴다", function () {
            const results = [];

            traverse(testData, (obj, path) => {
                results.push(path.toString());
            });

            expect(results).to.deep.equal([
                "a.aa.aaa",
                "a.aa.aab",
                "a.aa",
                "a.ab.aba",
                "a.ab.abb",
                "a.ab",
                "a.ac",
                "a",
                "b.ba",
                "b",
                ""
            ]);
        });

        it("array 내부도 순회할수 있다(값)", function () {
            const results = [];

            traverse(testData, (obj) => {
                results.push(obj);
            }, true);

            expect(results).to.deep.equal([
                "aaa", "aab",
                testData.a.aa,
                "aba", "abb",
                testData.a.ab,
                0, 10, 20, testData.a.ac[1], "2",
                testData.a.ac,
                testData.a,
                "ba",
                testData.b,
                testData
            ]);
        });

        it("array 내부도 순회할수 있다(path)", function () {
            const results = [];

            traverse(testData, (obj, path) => {
                results.push(path.toString());
            }, true);

            expect(results).to.deep.equal([
                "a.aa.aaa",
                "a.aa.aab",
                "a.aa",
                "a.ab.aba",
                "a.ab.abb",
                "a.ab",
                "a.ac[0]",
                "a.ac[1].ac1a",
                "a.ac[1].ac1b",
                "a.ac[1]",
                "a.ac[2]",
                "a.ac",
                "a",
                "b.ba",
                "b",
                ""
            ]);
        });
    });
});