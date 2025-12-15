
import { Type } from "@google/genai";

// 1. The Analyst's Tools (Charts)
export const ANALYTIC_TOOLS = [
  {
    name: "renderChart",
    description: "Renders a visual chart (Bar, Line, Pie) to visualize performance data.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        chartType: { type: Type.STRING, enum: ["bar", "line", "pie"] },
        data: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER }, label: { type: Type.STRING } }
          }
        },
        xAxisLabel: { type: Type.STRING }
      },
      required: ["title", "chartType", "data"]
    }
  }
];

// 2. The Planner's Tools (Checklists)
export const PLANNING_TOOLS = [
  {
    name: "createActionPlan",
    description: "Creates an interactive study checklist or action plan.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { task: { type: Type.STRING }, priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] } }
          }
        }
      },
      required: ["title", "items"]
    }
  }
];

// 3. The Professor's Tools (Diagrams & Mind Maps)
export const EDUCATIONAL_TOOLS = [
  {
    name: "renderDiagram",
    description: "Generates an SVG diagram to visualize a scientific concept (Physics, Math, Geometry).",
    parameters: {
      type: Type.OBJECT,
      properties: { 
        title: { type: Type.STRING }, 
        svgContent: { type: Type.STRING, description: "Valid, self-contained SVG code starting with <svg> tag." }, 
        description: { type: Type.STRING } 
      },
      required: ["title", "svgContent"]
    }
  },
  {
    name: "createMindMap",
    description: "Creates a hierarchical mind map for concept linkage.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        root: { 
          type: Type.OBJECT,
          properties: { label: { type: Type.STRING }, children: { type: Type.ARRAY, items: { type: Type.OBJECT } } },
          required: ["label"]
        }
      },
      required: ["root"]
    }
  }
];
