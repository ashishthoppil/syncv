/**
 * Renders a JSON-LD graph into the document.
 *
 * `<` is escaped because a literal `</script>` anywhere in the serialised data
 * would close the tag early and turn the rest of the payload into markup.
 */
export function JsonLd({ id, data }: { id: string; data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export default JsonLd;
