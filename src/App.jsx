import React, { useState } from "react";
import axios from "axios";
import Spinner from "./components/Spinner";

function App() {
  const [option, setOption] = useState("Generate Course");
  const [input, setInput] = useState("");
  const [courseId, setCourseId] = useState("");
  const [doubt, setDoubt] = useState("");
  const [user_answer, setAnswer] = useState("");
  const [response, setResponse] = useState(null);
  const [CourseResponse, setCourseResponse] = useState(null);
  const [ModuleResponse, setModuleResponse] = useState(null);
  const [MCQResponse, setMCQResponse] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const endpoint = option.replaceAll(" ", "_").toLowerCase();

      const payload = {
        input,
        course_id: courseId,
      };

      if (option === "Clarify Doubt") {
        payload.doubt = doubt;
      }

      if (option === "Analyze Content") {
        payload.user_answer = user_answer;
      }
      
      const res = await axios.post(`http://localhost:5000/${endpoint}`, payload);

      if (option === "Generate Course") {
        const courseDetails = res.data.course_details;
        setCourseResponse(courseDetails);
        setModuleResponse(null);
        setResponse(null);
        setMCQResponse(null);
        updateChatHistory(option, input, courseDetails);
      }

      else if (option === "Generate Modules") {
        const moduleDetails = res.data.module_details;
        setModuleResponse(moduleDetails);
        setCourseResponse(null);
        setResponse(null);
        setMCQResponse(null);
        updateChatHistory(option, input, moduleDetails);
      }

      else if (option === "Generate MCQ") {
        const mcqDetails = res.data.mcqs;
        setMCQResponse(mcqDetails);
        setCourseResponse(null);
        setResponse(null);
        updateChatHistory(option, input, mcqDetails);
      }

      else if (
        option === "Generate Summary" ||
        option === "Generate Example" ||
        option === "Generate Material" ||
        option === "Clarify Doubt" ||
        option === "Analyze Content"
      ) {
        const message = res.data.message;
        setResponse(message);
        setModuleResponse(null);
        setCourseResponse(null);
        setMCQResponse(null);
        updateChatHistory(option, input, message);
      }
    } 
    
    catch (error) {
      console.error(error);
      const errorMessage = "Error occurred while processing your request.";
      setResponse(errorMessage);
      updateChatHistory(option, input, errorMessage);
    } 
    
    finally {
      setLoading(false);
    }
  };

  const updateChatHistory = (option, input, responseData) => {
    setChatHistory((prevHistory) => [
      ...prevHistory,
      {
        option,
        userInput: input,
        backendResponse: responseData,
        doubt: option === "Clarify Doubt" ? doubt : undefined,
        user_answer: option === "Analyze Content" ? user_answer : undefined,
      },
    ]);
  };

  const renderTable = (data) => {
    return (
      <table className="min-w-full table-auto">
        <thead>
          <tr>
            <th className="px-4 py-2 border">Question Number</th>
            <th className="px-4 py-2 border">Question</th>
            <th className="px-4 py-2 border">Options</th>
            <th className="px-4 py-2 border">Your Answer</th>
            <th className="px-4 py-2 border">Correct Answer</th>
            <th className="px-4 py-2 border">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx}>
              <td className="px-4 py-2 border">{item.question_number}</td>
              <td className="px-4 py-2 border">{item.question}</td>
              <td className="px-4 py-2 border">
                <ul>
                  {item.options.map((option, idx) => (
                    <li key={idx}>{option}</li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-2 border">{item.selected_answer}</td>
              <td className="px-4 py-2 border">{item.correct_answer}</td>
              <td className="px-4 py-2 border">{item.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? "w-2/5" : "w-16"
        } bg-gray-800 text-white transition-all duration-300 ease-in-out fixed top-0 left-0 bottom-0 overflow-y-auto`}
      >
        <button
          className="text-white p-2"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? "Close" : "Open"} Sidebar
        </button>
        <div className="p-4">
          <h3 className="font-bold">Chat History</h3>
          <div className="space-y-2 mt-4">
            {chatHistory.map((chat, index) => (
              <div key={index}>
                <div className="font-semibold">Option:</div>
                <div className="text-sm text-gray-300">{chat.option}</div>
                <div className="font-semibold">User:</div>
                <div className="text-sm text-gray-300">{chat.userInput}</div>

                {chat.option === "Clarify Doubt" && (
                  <>
                    <div className="font-semibold mt-2">User's Doubt:</div>
                    <div className="text-sm text-gray-300">{chat.doubt}</div>
                  </>
                )}

                {chat.option === "Analyze Content" && (
                  <>
                    <div className="font-semibold mt-2">User's Answers:</div>
                    <div className="text-sm text-gray-300">{chat.user_answer}</div>
                  </>
                )}

                <div className="font-semibold mt-2">Response:</div>

                <div className="text-sm text-gray-300">
                  {chat.option === "Generate Course" ? (
                    <>
                      {chat.backendResponse.title && (
                        <p><strong>Title:</strong> {chat.backendResponse.title}</p>
                      )}
                      {chat.backendResponse.description && (
                        <p><strong>Description:</strong> {chat.backendResponse.description}</p>
                      )}
                      {chat.backendResponse.chapters && (
                        <div>
                          <strong>Chapters:</strong>
                          <ul className="list-disc ml-6">
                            {chat.backendResponse.chapters.map((chapter, idx) => (
                              <li key={idx}>{chapter}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : chat.option === "Generate Module" ? (
                    <ul className="list-disc ml-6">
                      {chat.backendResponse.map((module, index) => (
                        <li key={index}>{module}</li>
                      ))}
                    </ul>
                  ) : chat.option === "Generate Material" ? (
                    <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: chat.backendResponse }} />
                  ) : chat.option === "Generate MCQ" ? (
                    <div>
                      <strong>Generated MCQs:</strong>
                      <div className="space-y-4 mt-4">
                        {chat.backendResponse.map((mcq, idx) => (
                          <div key={idx} className="p-4 bg-white shadow rounded-md">
                            <p className="font-semibold">{mcq.question}</p>
                            <div className="mt-2">
                              <ul className="list-disc ml-6">
                                {mcq.options.map((option, idx) => (
                                  <li key={idx}>
                                    <span>{idx + 1}. {option}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="mt-2 text-sm text-gray-600">
                              <strong>Correct Answer: </strong>{mcq.answer}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                   ): option === "Analyze Content" && response ? (
                    <div>
                      <strong>Analysis:</strong>
                      {renderTable(response)}
                    </div>
                  ) : (
                    <p>{chat.backendResponse}</p>
                  )}
                </div>
                <hr className="my-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 ml-16 overflow-y-auto">
        <h1 className="text-4xl font-bold text-center mb-8">
          Course Content Generator
        </h1>
        <div className="flex items-center justify-center space-x-4 mb-6">
          <select
            className="p-2 bg-gray-200 rounded"
            onChange={(e) => setOption(e.target.value)}
          >
            <option>Generate Course</option>
            <option>Generate Modules</option>
            <option>Generate Material</option>
            <option>Generate Summary</option>
            <option>Generate Example</option>
            <option>Clarify Doubt</option>
            <option>Generate MCQ</option>
            <option>Analyze Content</option>
          </select>
          <input
            type="text"
            placeholder={`Enter input for ${option}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="p-2 bg-gray-200 rounded"
          />
          <input
            type="text"
            placeholder="Enter Course ID"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="p-2 bg-gray-200 rounded"
          />
          {option === "Clarify Doubt" && (
            <input
              type="text"
              placeholder="Enter your doubt"
              value={doubt}
              onChange={(e) => setDoubt(e.target.value)}
              className="p-2 bg-gray-200 rounded"
            />
          )}
          {option === "Analyze Content" && (
            <input
              type="text"
              placeholder="Enter your answers"
              value={user_answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="p-2 bg-gray-200 rounded"
            />
          )}
          <button
            onClick={handleSubmit}
            className="p-2 bg-blue-500 text-white rounded"
          >
            Submit
          </button>
        </div>

        {/* Response Box */}
        <div className="w-full p-4 bg-gray-100 rounded-md">
          {loading ? (
            <Spinner loading={loading} />
          ) : option === "Generate Course" && CourseResponse ? (
            <div>
              <p><strong>Course Name:</strong> {CourseResponse.title}</p>
              <p><strong>Description:</strong> {CourseResponse.description}</p>
              <p><strong>Duration:</strong> {CourseResponse.duration} hours</p>
              <div>
                <strong>Chapters:</strong>
                <ul className="list-disc ml-6">
                  {CourseResponse.chapters.map((chapter, index) => (
                    <li key={index}>{chapter}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : option === "Generate Modules" && ModuleResponse ? (
            <div>
              <strong>Modules:</strong>
              <ul className="list-disc ml-6">
                {ModuleResponse.map((module, index) => (
                  <li key={index}>{module}</li>
                ))}
              </ul>
            </div>
          ) : option === "Generate Material" && response ? (
            <div>
              <strong>Generated Material:</strong>
              <div
                className="text-gray-700"
                dangerouslySetInnerHTML={{ __html: response }}
              />
            </div>
          ) : option === "Generate Summary" && response ? (
            <div>
              <strong>{option} Generated Summary:</strong>
              <p className="text-gray-700">{response}</p>
            </div>
          ) : option === "Generate Example" && response ? (
            <div>
              <strong>Generated Example:</strong>
              <p className="text-gray-700">{response}</p>
            </div>
          ) : option === "Clarify Doubt" && response ? (
            <div>
              <strong>Answer:</strong>
              <p className="text-gray-700">{response}</p>
            </div>
          ) : option === "Analyze Content" && response ? (
            <div>
              <strong>Analysis:</strong>
              {renderTable(response)}
            </div>
          ) : option === "Generate MCQ" && response ? (
            <div>
              <strong>Generated MCQs:</strong>
              <div className="space-y-4 mt-4">
                {MCQResponse.map((mcq, index) => (
                  <div key={index} className="p-4 bg-white shadow rounded-md">
                    <p className="font-semibold">{mcq.question}</p>
                    <div className="mt-2 space-y-2">
                      {mcq.options.map((option, i) => (
                        <div key={i} className="flex items-center">
                          <input
                            type="radio"
                            name={`mcq${index}`}
                            id={`mcq${index}-option${i}`}
                          />
                          <label
                            htmlFor={`mcq${index}-option${i}`}
                            className="ml-2 text-gray-600"
                          >
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No response available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;



// import React, { useState } from "react";
// import axios from "axios";
// import Spinner from "./components/Spinner";

// function App() {
//   const [option, setOption] = useState("Generate Course"); // option selected by user
//   const [input, setInput] = useState(""); // User input
//   const [courseId, setCourseId] = useState(""); // course id set by user
//   const [doubt, setDoubt] = useState(""); // User doubt input
//   const [user_answer, setAnswer] = useState(""); // User answer input
//   const [response, setResponse] = useState(null); // response from backend
//   const [CourseResponse, setCourseResponse] = useState(null); // response from backend
//   const [ModuleResponse, setModuleResponse] = useState(null); // response from backend
//   const [chatHistory, setChatHistory] = useState([]); // Chat history
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar toggle
//   const [loading, setLoading] = useState(false); // loading state for spinner

//   const handleSubmit = async () => {
//     try {
//       setResponse(null); // Clear the response before fetching new data
//       setLoading(true); // Start loading spinner
//       const endpoint = option.replaceAll(" ", "_").toLowerCase();
//       const payload = {
//         input,
//         course_id: courseId,
//       };

//       if (option === "Clarify Doubt") {
//         payload.doubt = doubt; // Add the doubt field
//       }

//       if (option === "Analyze Content") {
//         payload.user_answer = user_answer; // Add the doubt field
//       }

//       const res = await axios.post(`http://localhost:5000/${endpoint}`, payload);

//       // Handle responses for different options
//       if (option === "Generate Course") {
//         const courseDetails = res.data.course_details;
//         setCourseResponse(courseDetails);
//         setModuleResponse(null); // Clear previous module response
//         setResponse(null); // Clear previous response
//         updateChatHistory(option, input, courseDetails);
//       }

//       else if (option === "Generate Modules") {
//         const moduleDetails = res.data.module_details;
//         setModuleResponse(moduleDetails);
//         setCourseResponse(null); // Clear previous course response
//         setResponse(null); // Clear previous response
//         updateChatHistory(option, input, moduleDetails);
//       }

//       else if (
//         option === "Generate Summary" ||
//         option === "Generate Example" ||
//         option === "Generate Material" ||
//         option === "Clarify Doubt" ||
//         option === "Generate MCQ" ||
//         option === "Analyze Content"
//       ) {
//         const message = res.data.message;
//         setResponse(message);
//         setModuleResponse(null); // Clear previous module response
//         setCourseResponse(null); // Clear previous course response
//         updateChatHistory(option, input, message);
//       }
//     }

//     catch (error) {
//       console.error(error);
//       const errorMessage = "Error occurred while processing your request.";
//       setResponse(errorMessage);
//       updateChatHistory(option, input, errorMessage);
//     }

//     finally {
//       setLoading(false); // Stop loading spinner after response
//     }
//   };

//   const updateChatHistory = (option, input, responseData) => {
//     setChatHistory((prevHistory) => [
//       ...prevHistory,
//       {option,
//         userInput: input,
//         backendResponse: responseData,
//         doubt: option === "Clarify Doubt" ? doubt : undefined,
//         user_answer: option === "Analyze Content" ? user_answer : undefined},
//     ]);
//   };

//   return (
//     <div className="flex h-screen overflow-hidden">
//       {/* Sidebar */}
//       <div
//         className={`${
//           isSidebarOpen ? "w-2/5" : "w-16"
//         } bg-gray-800 text-white transition-all duration-300 ease-in-out fixed top-0 left-0 bottom-0 overflow-y-auto`}
//       >
//         <button
//           className="text-white p-2"
//           onClick={() => setIsSidebarOpen(!isSidebarOpen)}
//         >
//           {isSidebarOpen ? "Close" : "Open"} Sidebar
//         </button>
//         <div className="p-4">
//           <h3 className="font-bold">Chat History</h3>
//           <div className="space-y-2 mt-4">
//             {chatHistory.map((chat, index) => (
//               <div key={index}>
//                 <div className="font-semibold">Option:</div>
//                 <div className="text-sm text-gray-300">{chat.option}</div>
//                 <div className="font-semibold">User:</div>
//                 <div className="text-sm text-gray-300">{chat.userInput}</div>

//                 {chat.option === "Clarify Doubt" && (
//                   <>
//                     <div className="font-semibold mt-2">User's Doubt:</div>
//                     <div className="text-sm text-gray-300">{chat.doubt}</div>
//                   </>
//                 )}

//                 {chat.option === "Analyze Content" && (
//                   <>
//                     <div className="font-semibold mt-2">User's Answers:</div>
//                     <div className="text-sm text-gray-300">{chat.user_answer}</div>
//                   </>
//                 )}

//                 <div className="font-semibold mt-2">Response:</div>

//                 {/* Displaying the response */}
//                 <div className="text-sm text-gray-300">
//                   {chat.option === "Generate Course" ? (
//                     <>
//                       {chat.backendResponse.title && (
//                         <p><strong>Title:</strong> {chat.backendResponse.title}</p>
//                       )}
//                       {chat.backendResponse.description && (
//                         <p><strong>Description:</strong> {chat.backendResponse.description}</p>
//                       )}
//                       {chat.backendResponse.chapters && (
//                         <div>
//                           <strong>Chapters:</strong>
//                           <ul className="list-disc ml-6">
//                             {chat.backendResponse.chapters.map((chapter, idx) => (
//                               <li key={idx}>{chapter}</li>
//                             ))}
//                           </ul>
//                         </div>
//                       )}
//                     </>
//                   ) : chat.option === "Generate Module" ? (
//                     <ul className="list-disc ml-6">
//                       {chat.backendResponse.map((module, index) => (
//                         <li key={index}>{module}</li>
//                       ))}
//                     </ul>
//                   ) : chat.option === "Generate MCQ" ? (
//                     <div>
//                       <strong>Generated MCQs:</strong>
//                       <div className="space-y-4 mt-4">
//                         {chat.backendResponse.map((mcq, idx) => (
//                           <div key={idx} className="p-4 bg-white shadow rounded-md">
//                             <p className="font-semibold">{mcq.question}</p>
//                             <div className="mt-2">
//                               <ul className="list-disc ml-6">
//                                 {mcq.options.map((option, idx) => (
//                                   <li key={idx}>
//                                     <span>{idx + 1}. {option}</span>
//                                   </li>
//                                 ))}
//                               </ul>
//                             </div>
//                             <div className="mt-2 text-sm text-gray-600">
//                               <strong>Correct Answer: </strong>{mcq.answer}
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   ) : (
//                     <p>{chat.backendResponse}</p>
//                   )}
//                 </div>
//                 <hr className="my-2" />
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="flex-1 p-8 ml-16 overflow-y-auto">
//         <h1 className="text-4xl font-bold text-center mb-8">
//           Course Content Generator
//         </h1>
//         <div className="flex items-center justify-center space-x-4 mb-6">
//           <select
//             className="p-2 bg-gray-200 rounded"
//             onChange={(e) => setOption(e.target.value)}
//           >
//             <option>Generate Course</option>
//             <option>Generate Modules</option>
//             <option>Generate Material</option>
//             <option>Generate Summary</option>
//             <option>Generate Example</option>
//             <option>Clarify Doubt</option>
//             <option>Generate MCQ</option>
//             <option>Analyze Content</option>
//           </select>
//           <input
//             type="text"
//             placeholder={`Enter input for ${option}`}
//             value={input}
//             onChange={(e) => setInput(e.target.value)}
//             className="p-2 bg-gray-200 rounded"
//           />
//           <input
//             type="text"
//             placeholder="Enter Course ID"
//             value={courseId}
//             onChange={(e) => setCourseId(e.target.value)}
//             className="p-2 bg-gray-200 rounded"
//           />
//           {option === "Clarify Doubt" && (
//             <input
//               type="text"
//               placeholder="Enter your doubt"
//               value={doubt}
//               onChange={(e) => setDoubt(e.target.value)}
//               className="p-2 bg-gray-200 rounded"
//             />
//           )}
//           {option === "Analyze Content" && (
//             <input
//               type="text"
//               placeholder="Enter your answers"
//               value={user_answer}
//               onChange={(e) => setAnswer(e.target.value)}
//               className="p-2 bg-gray-200 rounded"
//             />
//           )}
//           <button
//             onClick={handleSubmit}
//             className="p-2 bg-blue-500 text-white rounded"
//           >
//             Submit
//           </button>
//         </div>

//         {/* Response Box */}
//         <div className="w-full p-4 bg-gray-100 rounded-md">
//           {loading ? (
//             <Spinner loading={loading} />
//           ) : option === "Generate Course" && CourseResponse ? (
//             <div>
//               <p><strong>Course Name:</strong> {CourseResponse.title}</p>
//               <p><strong>Description:</strong> {CourseResponse.description}</p>
//               <p><strong>Duration:</strong> {CourseResponse.duration} hours</p>
//               <div>
//                 <strong>Chapters:</strong>
//                 <ul className="list-disc ml-6">
//                   {CourseResponse.chapters.map((chapter, index) => (
//                     <li key={index}>{chapter}</li>
//                   ))}
//                 </ul>
//               </div>
//             </div>
//           ) : option === "Generate Modules" && ModuleResponse ? (
//             <div>
//               <strong>Modules:</strong>
//               <ul className="list-disc ml-6">
//                 {ModuleResponse.map((module, index) => (
//                   <li key={index}>{module}</li>
//                 ))}
//               </ul>
//             </div>
//           ) : option === "Generate Material" && response ? (
//             <div>
//               <strong>Generated Material:</strong>
//               <p className="text-gray-700">{response}</p>
//             </div>
//           ) : option === "Generate Summary" && response ? (
//             <div>
//               <strong>{option} Generated Summary:</strong>
//               <p className="text-gray-700">{response}</p>
//             </div>
//           ) : option === "Generate Example" && response ? (
//             <div>
//               <strong>Generated Example:</strong>
//               <p className="text-gray-700">{response}</p>
//             </div>
//           ) : option === "Clarify Doubt" && response ? (
//             <div>
//               <strong>Answer:</strong>
//               <p className="text-gray-700">{response}</p>
//             </div>
//           ) : option === "Analyze Content" && response ? (
//             <div>
//               <strong>Analysis:</strong>
//               <p className="text-gray-700">{response}</p>
//             </div>
//           ) : option === "Generate MCQ" && response ? (
//             <div>
//               <strong>Generated MCQs:</strong>
//               <div className="space-y-4 mt-4">
//                 {response.map((mcq, index) => (
//                   <div key={index} className="p-4 bg-white shadow rounded-md">
//                     <p className="font-semibold">{mcq.question}</p>
//                     <div className="mt-2">
//                       <ul className="list-disc ml-6">
//                         {mcq.options.map((option, idx) => (
//                           <li key={idx}>
//                             <span>{idx + 1}. {option}</span>
//                           </li>
//                         ))}
//                       </ul>
//                     </div>
//                     <div className="mt-2 text-sm text-gray-600">
//                       <strong>Correct Answer: </strong>{mcq.answer}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           ) : (
//             <p>No response available</p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;
