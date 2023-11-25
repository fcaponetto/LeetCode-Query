import LeetCode from "../leetcode";
import Credential from "../credential";

async function test() {

    if(process.argv.length < 2)
    {
        console.error("Error: Missing session ID.");
        process.exit(1);
    }
    const session = process.argv[2];

    const credential = new Credential();
    await credential.init(session);
    const leetcode = new LeetCode(credential);

    const user = await leetcode.whoami();

    if (!user.isSignedIn)
    {
        console.log("No user found! Is your session expired?");
        process.exit(1);
    }

    const resultsOnEachChunk = 10;
    let hasMoreData = true;
    let offset = 0;

    while (hasMoreData)
    {
        const [submissions, currentHasMoreData] = await leetcode.submissions(resultsOnEachChunk, offset, true);

        offset += 10;
        hasMoreData = currentHasMoreData;
        console.log(submissions);
        console.log("****", offset, "****");
    }

    console.log(await leetcode.submissions(10, 0, true, "two-sum-ii-input-array-is-sorted"));
}

test();