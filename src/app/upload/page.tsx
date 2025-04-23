import {
  generateGetSignedUrl,
  getPublicUrl,
  listFilesInS3Path,
  uploadFileToS3,
  type UploadParams,
} from "@/libs/aws/s3";
import { lookup } from "mime-types";
import { revalidatePath } from "next/cache";

async function uploadAction(formData: FormData) {
  "use server";
  const file = formData.get("file") as File;
  if (!file) {
    console.error("File is required");
  }

  if (file.size === 0) {
    console.error("File is empty");
  }

  const privateFile = formData.get("private") as string;

  const isPrivate = privateFile === "on" || privateFile === "true";

  if (!file.name) {
    throw new Error("File name is required");
  }

  // file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadParams: UploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME || "",
    Key: `test/${file.name}`,
    Body: buffer,
    ContentType: file.type,
    ACL: isPrivate ? "private" : "public-read",
  };

  console.log(uploadParams);

  await uploadFileToS3(uploadParams);

  revalidatePath("/upload");
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{
    unhide: string;
  }>;
}) {
  const { unhide } = await searchParams;

  const files = await listFilesInS3Path("teqhire-store-dev", "test");

  console.log("Files in S3:", files);

  const fileUrls = await Promise.all(
    files.map(async (file) => {
      const mimeType = lookup(file.key as string);
      console.log("MIME Type:", mimeType);

      let url = "";

      if (unhide === "on") {
        // If accessing PRIVATE
        url = await generateGetSignedUrl(
          "teqhire-store-dev",
          file.key as string,
          10
        );
      }
      // If accessing PUBLIC
      else {
        url = getPublicUrl(
          process.env.AWS_BUCKET_NAME || "",
          file.key as string
        );
      }

      //   // If accessing PUBLIC
      //   const url = getPublicUrl(
      //     process.env.AWS_BUCKET_NAME || "",
      //     file.key as string
      //   );
      return {
        url,
        key: file.key,
        size: file.size,
        lastModified: file.lastModified,
        mimeType,
      };
    })
  );

  console.log("Public URLs:", fileUrls);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-black">
      <h1>Upload</h1>
      <form
        action={uploadAction}
        // encType="multipart/form-data"
        className="flex flex-col items-center"
      >
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx,image/*"
          className="mb-4 p-2 border border-gray-300 rounded"
        />
        <div className="space-x-2">
          <input
            type="checkbox"
            name="private"
            className="mb-4 p-2 border border-gray-300 rounded"
          />
          <label htmlFor="private" className="mb-4">
            Upload private file
          </label>
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Upload
        </button>
      </form>

      <br />
      <div>
        <div className="w-full flex flex-col items-center">
          <div>
            <h2>FILES</h2>
          </div>
          <div>
            <form
              action="/upload"
              method="get"
              className="ml-4 flex justify-center"
            >
              <input
                type="checkbox"
                name="unhide"
                id="unhide"
                defaultChecked={Boolean(!unhide)}
                className="hidden mb-4 p-2 border border-gray-300 rounded"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                {unhide === "on" ? "Hide Private Files" : "Show Private Files"}
              </button>
            </form>
            <div>
              {unhide === "on" ? (
                <p className="text-red-500">
                  Private files are visible, signed url can be used for manually
                  set 300 seconds
                </p>
              ) : (
                <p className="text-green-500">
                  Private files are hidden, public urls can still be shown
                  permanently
                </p>
              )}
            </div>
            <br />
          </div>
        </div>
        {fileUrls.map((file) => (
          <div
            key={file.key}
            className="mb-2 p-2 border border-gray-300 rounded"
          >
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {file.key}
            </a>
            <p>Size: {file.size} bytes</p>
            <p>
              Last Modified:{" "}
              {new Date(file.lastModified as Date).toLocaleString()}
            </p>
            <p>{file.url}</p>
            {/** if image */}
            {file.mimeType && file.mimeType?.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.url}
                alt={file.key}
                className="mt-2 w-32 h-32 object-cover"
              />
            )}

            {/** if pdf or other file */}
            {file.mimeType && !file.mimeType?.startsWith("image/") && (
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-blue-500 hover:underline"
              >
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
