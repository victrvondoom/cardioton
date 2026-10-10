import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "../src/components/AppShell";

vi.mock("../src/components/ActivityTicker",()=>({ActivityTicker:()=>null}));
vi.mock("../src/components/TopBar",()=>({TopBar:()=>null}));
vi.mock("../src/components/Sidenav",()=>({Sidenav:()=>null}));
vi.mock("../src/components/FAB",()=>({FAB:()=>null}));
vi.mock("../src/components/SearchPalette",()=>({SearchPalette:()=>null}));
vi.mock("../src/components/SpatialBackdrop",()=>({SpatialBackdrop:()=>null}));
vi.mock("../src/workflow/WorkflowNavigation",()=>({WorkflowNavigation:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it("the real application shell retains one Atlas reconstruction across all workspace paths",()=>{
  vi.stubGlobal("matchMedia",()=>({matches:true}));vi.stubGlobal("scrollTo",vi.fn());
  function Workspace(){const [knownDate,setKnownDate]=useState("2026-08-21");const {tab}=useParams();return <><p>{knownDate}</p><p>{tab}</p><button onClick={()=>setKnownDate("2026-08-10")}>Replay earlier</button><Link to="/cardiotwin/atlas/graph">Graph tab</Link><Link to="/cardiotwin/atlas/spatial">Map tab</Link><Link to="/cardiotwin/atlas/command">Command tab</Link><Link to="/other">Leave Atlas</Link></>;}
  render(<MemoryRouter initialEntries={["/cardiotwin/atlas"]}><Routes><Route element={<AppShell/>}><Route path="/cardiotwin/atlas/:tab?" element={<Workspace/>}/><Route path="/other" element={<Link to="/cardiotwin/atlas">Return to Atlas</Link>}/></Route></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole("button",{name:"Replay earlier"}));
  for(const name of ["Graph tab","Map tab","Command tab"]){fireEvent.click(screen.getByRole("link",{name}));expect(screen.getByText("2026-08-10")).toBeTruthy();}
  fireEvent.click(screen.getByRole("link",{name:"Leave Atlas"}));fireEvent.click(screen.getByRole("link",{name:"Return to Atlas"}));expect(screen.getByText("2026-08-21")).toBeTruthy();
});
