import EventEmitter from "events";
import fetch, { Response } from "node-fetch";
import { Cache, cache as default_cache } from "./cache";
import { BASE_URL, USER_AGENT } from "./constants";
import { Credential } from "./credential";
import CONTEST from "./graphql/contest";
import DAILY from "./graphql/daily";
import PROBLEM from "./graphql/problem";
import PROBLEMS from "./graphql/problems";
import PROFILE from "./graphql/profile";
import RECENT_SUBMISSIONS from "./graphql/recent-submissions";
import SUBMISSIONS from "./graphql/submissions";
import WHOAMI from "./graphql/whoami";
import type {
    DailyChallenge,
    Problem,
    ProblemList,
    RecentSubmission,
    Submission,
    SubmissionDetail,
    UserContestInfo,
    UserProfile,
    Whoami,
} from "./leetcode-types";
import { RateLimiter } from "./mutex";
import type { LeetCodeGraphQLQuery, LeetCodeGraphQLResponse } from "./types";
import { parse_cookie } from "./utils";

export class LeetCode extends EventEmitter {
    /**
     * The credential this LeetCode instance is using.
     */
    public credential: Credential;

    /**
     * The internal cache.
     */
    public cache: Cache;

    /**
     * Used to ensure the LeetCode instance is initialized.
     */
    private initialized: Promise<boolean>;

    /**
     * Rate limiter
     */
    public limiter = new RateLimiter();

    /**
     * If a credential is provided, the LeetCode API will be authenticated. Otherwise, it will be anonymous.
     * @param credential
     * @param cache
     */
    constructor(credential: Credential | null = null, cache = default_cache) {
        super();
        let initialize: CallableFunction;
        this.initialized = new Promise((resolve) => {
            initialize = resolve;
        });

        this.cache = cache;

        if (credential) {
            this.credential = credential;
            setImmediate(() => initialize());
        } else {
            this.credential = new Credential();
            this.credential.init().then(() => initialize());
        }
    }

    /**
     * Get public profile of a user.
     * @param username
     * @returns
     *
     * ```javascript
     * const leetcode = new LeetCode();
     * const profile = await leetcode.user("jacoblincool");
     * ```
     */
    public async user(username: string): Promise<UserProfile> {
        await this.initialized;
        const { data } = await this.graphql({
            variables: { username },
            query: PROFILE,
        });
        return data as UserProfile;
    }

    /**
     * Get public contest info of a user.
     * @param username
     * @returns
     *
     * ```javascript
     * const leetcode = new LeetCode();
     * const profile = await leetcode.user_contest_info("jacoblincool");
     * ```
     */
    public async user_contest_info(username: string): Promise<UserContestInfo> {
        await this.initialized;
        const { data } = await this.graphql({
            variables: { username },
            query: CONTEST,
        });
        return data as UserContestInfo;
    }

    /**
     * Get recent submissions of a user. (max: 20 submissions)
     * @param username
     * @param limit
     * @returns
     *
     * ```javascript
     * const leetcode = new LeetCode();
     * const submissions = await leetcode.recent_submissions("jacoblincool");
     * ```
     */
    public async recent_submissions(username: string, limit = 20): Promise<RecentSubmission[]> {
        await this.initialized;
        const { data } = await this.graphql({
            variables: { username, limit },
            query: RECENT_SUBMISSIONS,
        });
        return (data.recentSubmissionList as RecentSubmission[]) || [];
    }

    /**
     * Get all the submissions of the user. Need to be authenticated.
     *
     * @param limit number of results for each request. It is required.
     * @param offset starting point for the request. It starts from 0 by default
     * @param onlyAccepted if true, it filters out not accepted submissions.
     * @param slug name of the problem. If empty, all submitted problems are retrieved.
     *
     * @returns [submissions, hasMoreData]
     * list of submissions (if any) a boolean that indicates if more data are available
     *
     * ```javascript
     * const credential = new Credential();
     * await credential.init("SESSION");
     * const leetcode = new LeetCode(credential);
     * const submissions = await leetcode.submissions({ limit: 100, offset: 0 });
     * ```
     */
    public async submissions({
        limit,
        offset = 0,
        onlyAccepted = false,
        slug,
    }: {
        limit: number;
        offset?: number;
        onlyAccepted?: boolean;
        slug?: string;
    }): Promise<[Submission[], boolean]> {
        await this.initialized;

        const submissions: Submission[] = [];
        const set = new Set<number>();
        let hasMoreData = false;

        let cursor = offset;
        while (submissions.length < limit) {
            const { data } = await this.graphql({
                variables: {
                    offset: cursor,
                    limit: limit - submissions.length > 20 ? 20 : limit - submissions.length,
                    slug: slug,
                },
                query: SUBMISSIONS,
            });

            for (const submission of data.submissionList.submissions) {
                // Accepted = 10
                // Wrong answer = 11
                // Runtime error = 15
                if (onlyAccepted && submission.status != 10) {
                    continue;
                }

                submission.id = parseInt(submission.id, 10);
                submission.timestamp = parseInt(submission.timestamp, 10) * 1000;
                submission.isPending = submission.isPending !== "Not Pending";
                submission.runtime = parseInt(submission.runtime, 10) || 0;
                submission.memory = parseFloat(submission.memory) || 0;

                if (set.has(submission.id)) {
                    continue;
                }

                set.add(submission.id);
                submissions.push(submission);
            }

            hasMoreData = data.submissionList.hasNext;
            if (!data.submissionList.hasNext) {
                break;
            }

            cursor += 20;
        }

        return [submissions, hasMoreData];
    }

    /**
     * Get detail of a submission, including the code and percentiles.
     * Need to be authenticated.
     * @param id Submission ID
     * @returns
     */
    public async submission(id: number): Promise<SubmissionDetail> {
        await this.initialized;

        try {
            await this.limiter.lock();

            const res = await fetch(`${BASE_URL}/submissions/detail/${id}/`, {
                headers: {
                    origin: BASE_URL,
                    referer: BASE_URL,
                    cookie: `csrftoken=${this.credential.csrf || ""}; LEETCODE_SESSION=${
                        this.credential.session || ""
                    };`,
                    "user-agent": USER_AGENT,
                },
            });
            const raw = await res.text();
            const data = raw.match(/var pageData = ({[^]+?});/)?.[1];
            const json = new Function("return " + data)();
            const result = {
                id: parseInt(json.submissionId),
                problem_id: parseInt(json.questionId),
                runtime: parseInt(json.runtime),
                runtime_distribution: json.runtimeDistributionFormatted
                    ? (JSON.parse(json.runtimeDistributionFormatted).distribution.map(
                          (item: [string, number]) => [+item[0], item[1]],
                      ) as [number, number][])
                    : [],
                runtime_percentile: 0,
                memory: parseInt(json.memory),
                memory_distribution: json.memoryDistributionFormatted
                    ? (JSON.parse(json.memoryDistributionFormatted).distribution.map(
                          (item: [string, number]) => [+item[0], item[1]],
                      ) as [number, number][])
                    : [],
                memory_percentile: 0,
                code: json.submissionCode,
                details: json.submissionData,
            };

            result.runtime_percentile = result.runtime_distribution.reduce(
                (acc, [usage, p]) => acc + (usage >= result.runtime ? p : 0),
                0,
            );
            result.memory_percentile = result.memory_distribution.reduce(
                (acc, [usage, p]) => acc + (usage >= result.memory / 1000 ? p : 0),
                0,
            );

            this.limiter.unlock();
            return result;
        } catch (err) {
            this.limiter.unlock();
            throw err;
        }
    }

    /**
     * Get a list of problems by tags and difficulty.
     * @param option
     * @param option.category
     * @param option.offset
     * @param option.limit
     * @param option.filters
     * @returns
     */
    public async problems({
        category = "",
        offset = 0,
        limit = 100,
        filters = {},
    }: {
        category?: string;
        offset?: number;
        limit?: number;
        filters?: {
            difficulty?: "EASY" | "MEDIUM" | "HARD";
            tags?: string[];
        };
    } = {}): Promise<ProblemList> {
        await this.initialized;

        const variables = { categorySlug: category, skip: offset, limit, filters };

        const { data } = await this.graphql({
            variables,
            query: PROBLEMS,
        });

        return data.problemsetQuestionList as ProblemList;
    }

    /**
     * Get information of a problem by its slug.
     * @param slug Problem slug
     * @returns
     *
     * ```javascript
     * const leetcode = new LeetCode();
     * const problem = await leetcode.problem("two-sum");
     * ```
     */
    public async problem(slug: string): Promise<Problem> {
        await this.initialized;
        const { data } = await this.graphql({
            variables: { titleSlug: slug.toLowerCase().replace(/\s/g, "-") },
            query: PROBLEM,
        });

        return data.question as Problem;
    }

    /**
     * Get daily challenge.
     * @returns
     *
     * @example
     * ```javascript
     * const leetcode = new LeetCode();
     * const daily = await leetcode.daily();
     * ```
     */
    public async daily(): Promise<DailyChallenge> {
        await this.initialized;
        const { data } = await this.graphql({
            query: DAILY,
        });

        return data.activeDailyCodingChallengeQuestion as DailyChallenge;
    }

    /**
     * Check the information of the credential owner.
     * @returns
     */
    public async whoami(): Promise<Whoami> {
        await this.initialized;
        const { data } = await this.graphql({
            operationName: "globalData",
            variables: {},
            query: WHOAMI,
        });

        return data.userStatus as Whoami;
    }

    /**
     * Use GraphQL to query LeetCode API.
     * @param query
     * @returns
     */
    public async graphql(query: LeetCodeGraphQLQuery): Promise<LeetCodeGraphQLResponse> {
        await this.initialized;

        try {
            await this.limiter.lock();

            const BASE = BASE_URL;
            const res = await fetch(`${BASE}/graphql`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    origin: BASE,
                    referer: BASE,
                    cookie: `csrftoken=${this.credential.csrf || ""}; LEETCODE_SESSION=${
                        this.credential.session || ""
                    };`,
                    "x-csrftoken": this.credential.csrf || "",
                    "user-agent": USER_AGENT,
                },
                body: JSON.stringify(query),
            });
            this.emit("receive-graphql", res.clone());

            if (res.headers.has("set-cookie")) {
                const cookies = parse_cookie(res.headers.get("set-cookie") as string);

                if (cookies["csrftoken"]) {
                    this.credential.csrf = cookies["csrftoken"];
                    this.emit("update-csrf", this.credential);
                }
            }

            //////////////////////////////////////
            // Uncomment the following in case of query issues
            /////////////////////////////////////

            // console.log("Sending query with:", JSON.stringify(query));
            // console.log("Received headers:", res.headers);
            // console.log("Response status:", res.status);

            this.limiter.unlock();
            return res.json();
        } catch (err) {
            this.limiter.unlock();
            throw err;
        }
    }
}

export declare interface LeetCode {
    emit(event: "receive-graphql", res: Response): boolean;
    emit(event: "update-csrf", credential: Credential): boolean;
    emit(event: string, ...args: unknown[]): boolean;

    on(event: "receive-graphql", listener: (res: Response) => void): this;
    on(event: "update-csrf", listener: (credential: Credential) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;

    once(event: "receive-graphql", listener: (res: Response) => void): this;
    once(event: "update-csrf", listener: (credential: Credential) => void): this;
    once(event: string, listener: (...args: unknown[]) => void): this;
}

export default LeetCode;
