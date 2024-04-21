import Credential from "../credential";
import LeetCode from "../leetcode";

async function test() {
    if (process.argv.length < 2) {
        console.error("Error: Missing session ID.");
        process.exit(1);
    }
    const session = process.argv[2];

    const credential = new Credential();
    await credential.init(session);
    const leetcode = new LeetCode(credential);

    const user = await leetcode.whoami();

    if (!user.isSignedIn) {
        console.log("No user found! Is your session expired?");
        process.exit(1);
    }

    const resultsOnEachChunk = 10;
    let hasMoreData = true;
    let offset = 0;

    /** Get all submissions **/
    while (hasMoreData) {
        const [submissions, currentHasMoreData] = await leetcode.submissions({
            limit: resultsOnEachChunk,
            offset: offset,
            onlyAccepted: true,
        });

        offset += 10;
        hasMoreData = currentHasMoreData;
        console.log(submissions);
        console.log("****", offset, "****");
    }

    /** Get a specific one **/
    const singleSubmission = await leetcode.submissions({
            limit: 10,
            offset: 0,
            onlyAccepted: true,
            slug: "flatten-nested-list-iterator",
        });
    console.log(singleSubmission);

    /** Get a specific submission **/
    const submission = await leetcode.submission(1097389236);
    console.log(submission.code);

    /** Get a specific problem **/
    const problem = await leetcode.problem("flatten-nested-list-iterator");
    console.log(problem);
}

test();
