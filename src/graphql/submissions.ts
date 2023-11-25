export default `
query ($offset: Int!, $limit: Int!, $slug: String) {
    submissionList(offset: $offset, limit: $limit, questionSlug: $slug) {
        hasNext
        submissions {
          id
          title
          titleSlug
          status
          statusDisplay
          lang
          langName
          runtime
          timestamp
          url
          isPending
          memory
          hasNotes
          notes
        }
    }
}
`;
