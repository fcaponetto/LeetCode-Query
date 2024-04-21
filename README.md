# LeetCode Query

The API to get user profiles, submissions, and problems on LeetCode, with highly customizable GraphQL API and Rate Limiter.


## Examples

### Get An User's Public Profile

Includes recent submissions and posts.

Check [test example](./src/test/leetcode-test.ts)

```typescript
import { LeetCode } from "leetcode-query";

const leetcode = new LeetCode();
const user = await leetcode.user("username");
```

### Get All Of Your Submissions

```typescript
import { LeetCode, Credential } from "leetcode-query";

const credential = new Credential();
await credential.init("YOUR-LEETCODE-SESSION-COOKIE");

const leetcode = new LeetCode(credential);
console.log((await leetcode.submissions(100, 0)));
```

## Postman collection

[Postman collection to be imported](./LeetCode-Query.postman_collection.json)

![image](https://github.com/fcaponetto/LeetCode-Query/assets/11439681/d0e8cb72-fe1a-4ae0-928c-1de06640de40)
