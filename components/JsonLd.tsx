// JsonLd — renderiza un bloque <script type="application/ld+json"> en el head.
// Uso: <JsonLd data={schemaObject} />
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
