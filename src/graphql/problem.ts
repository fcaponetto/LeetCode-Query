export default `
query ($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        content
        isPaidOnly
        difficulty
        exampleTestcases
        topicTags {
            name
            slug
        }
        companyTagStats
        stats
        hints
        solution {
            id
            canSeeDetail
            paidOnly
            hasVideoSolution
            paidOnlyVideo
        }
        status
        sampleTestCase
        metaData
        judgerAvailable
        judgeType
        mysqlSchemas
        enableRunCode
        enableTestMode
        enableDebugger
        libraryUrl
        adminUrl
        note
    }
}
`;
