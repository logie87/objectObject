# objectObject
natHacks 2025 Project. Team [object Object] with Matvey, Alex, Logan, Harsh, Omeline, and Phil.

Documentation and individual collaboration can be found here
[Documentation & Planning](https://docs.google.com/document/d/12S5SSF4ts7tFLp9XUUz2E9-XzPpFBCCnA97Yss0YiZk/edit?usp=sharing)

Presenting...

# Instructive
### Helping teachers reach every student


Instructive is an advanced Education Management System designed to transform the administrative management of Individual Education Plans (IEPs). An IEP is a tailored plan that supports students’ unique learning needs, providing structured goals, accommodations, and personalized strategies to ensure educational success. In modern classrooms, meeting the diverse needs of students is complex as teachers must adapt assignments, learning environments, and assessment methods while maintaining high-quality instruction. This complexity grows in larger classrooms, where manual tracking and planning can become overwhelming.
Instructive addresses these challenges by centralizing IEPs, curriculum, core competencies, and teacher reports within a unified platform. Leveraging a local open-source LLM, teachers can efficiently generate assessment plans, propose adaptation strategies, and track progress against learning targets, while aligning with governmental requirements. Educators can also create custom units, define learning objectives, and instantly evaluate alignment, providing insights to guide instruction.
During development, we encountered challenges including backend and frontend integration issues with initial API calls, and unreliable LLM output during alignment score evaluation. These were addressed by refining the output-generation algorithm and improving integration logic. Implementation of secure login added another layer of complexity
A critical part of this project was teamwork: with members collaborating on code, we relied heavily on version control. Mismanaged branch merges sometimes led to lost code, underscoring the importance of disciplined collaboration. Overall, this project provided hands-on experience with secure system design, LLM utilization, and collaborative software development, while delivering a tool that empowers educators to provide equitable, high quality instruction for all students.


# About The Project

## Inspiration
Having the chance to accommodate students with Individualized Education Plan (IEP) can enhance the study environment for classrooms and teachers. However, going through each IEP takes a big chunk of a teacher's time, and often can be skimmed over, missing the important details. With these details missing, the student struggles without the required accommodations. In our research, we have obtained teachers' opinions, and have requested an alternative to reading IEPs, but still get the important details.

IEPs are long documents, provided by professionals, such as the counselor in the school. There was an approximate of 545,805 students attending public schools in 2019, and out of these **more than 54,580 students had an IEP**. This is a significant population, especially compared to the approximate **46,600 teachers and 10,350 education assistants**. Through our interview with teachers, we are informed of the issue that there are too many students and nothing to help the teachers learn about the accommodations certain students may need. Without the right resources, this not only affects the teacher, but also the student learning, and how their education is being taught in a way for them to succeed.

## What it does
Instructive is a Education Management System focused on revitalizing the adminisrative side of IEP management. An Individual Education Plan, better known as an IEP, is a student-specific plan to help foster a better learning environment without compromising quality. It is a dynamic outline that allows students to meet with teachers, and counsellors to plan for their success in a way that best suits them. An IEP for a student with a common learning disability would include educational goals, achievements, various learning preferences among categories, and accommodations.

## Our Solution
The solution, Instructive, a teachers assistant. Instructive takes in the curriculum, IEPs for each student, core competencies, and teacher reports. This takes less time to create student profiles, new IEPs, and ensures learning targets are met for each student just as well. This enhances the quality of education provided to each student and creates a more effective school environment.

## How it works

Powered by a **local open-source LLM model**, teachers are provided the capability to create effective assessment plans, for specific classes which meet the adaptations or accommodations students might need. These plans ensure the learning targets are met. Fortunately, there is more Instructive can do. Teachers have the ability to create new units, add new learning targets, and re-confirm that the curriculum and core competencies set by the government are met.

## How we built it
Using React TS as the front end, and Python as the backend, the program is user friendly and easy to learn, while providing important functionality for the teacher. The teacher has the option to review reports for each student allowing them to include adaptations or accommodations to improve the learning environment for each student. This comes without the stress of reading each IEP for each student. This boosts the teaching experience for the teacher and the learning experience for the student. 

## Challenges we ran into
Development did not come without obstacles. Early integration between the frontend and backend proved difficult, particularly when implementing initial API calls and ensuring data synchronization. Another challenge involved translating teacher needs into practical workflow features. Each school and classroom has unique structures, resource availability, and student needs, requiring flexible and adaptive system design. While obtaining the alignment score from the LLM, the outputs were poorly generated. This is critical since it could ruin the chances of helping teachers correctly include adaptations.

## Accomplishments that we're proud of
Over the 64 hour weekend, we are able to integrate a functioning LLM model, designed to assist teachers. The LLM model is able to produce assessments plans for specific classes, suggests adaptation plans based on IEPs, and ensures the learning targets are met similarly for everyone. One of the biggest accomplishments is getting the LLM model to work with the front end. With all this, we could store the LLM and data on our own devices

Another major win is being able to provide a functioning program. Seeing the program is able to provide results allows for a view in real life implementation for teachers. This gives hope for the future of Instructive, and a way to help teachers.

## What we learned
Through these challenges, our team gained invaluable skills and experience. We implemented secure login functionality, ensuring safe and authenticated access for teachers. Working with a locally-run LLM taught us how to generate reliable outputs tailored to our application’s needs, refining both logic and workflow. Most importantly, with members contributing to the codebase, we strengthened our teamwork and collaboration skills. Version control was essential; we experienced firsthand how poor branch merging could lead to lost work, reinforcing disciplined practices in collaborative software development.

## What's next for Instructive
Taking a look into the future, we are excited to expand Instructive to new curriculums. Having the capability of taking in different kinds of reports, and providing each teacher with the support they need, can enhance education around the world. Although these would not come without struggles and hardships, the outcome will allow not only teachers to excel, but the student to excel in their learning. 

